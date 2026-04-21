import express from "express";
import http from "http";
import { WebSocketServer, WebSocket } from "ws";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { HttpsProxyAgent } from "https-proxy-agent";
import { ProxyAgent, fetch as undiciFetch } from "undici";
import fs from "fs";
import { StateGraph, START, END, Annotation } from "@langchain/langgraph";
import nodemailer from "nodemailer";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { Pool } from "pg";

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || "xuedingtoken_secret_key_123456";

// PostgreSQL Pool Setup
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// In-memory store for email verification codes
const verificationCodes = new Map<string, { code: string; expiresAt: number }>();

export interface Schema {
  type: Type;
  properties?: { [key: string]: Schema };
  items?: Schema;
  description?: string;
  additionalProperties?: Schema;
  required?: string[];
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Logging Helper ---
const logPath = path.join(process.cwd(), "app.log");
function logToFile(message: string) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${message}\n`;
  fs.appendFileSync(logPath, logEntry);
  console.log(message);
}

// --- LangGraph Workflow Implementation ---

// 1. Define the Graph State
const ScriptState = Annotation.Root({
  scriptContent: Annotation<string>(),
  suggestedTitle: Annotation<string>(),
  characters: Annotation<any[]>(),
  scenes: Annotation<any[]>(),
  props: Annotation<any[]>(),
  storyboard: Annotation<any[]>(),
  error: Annotation<string | null>(),
  apiKey: Annotation<string | null>(), // Add apiKey to state
});

async function startServer() {
  const app = express();
  const PORT = 3001;

  app.use(cors({ origin: "*" }));
  app.use(express.json({ limit: '10mb' }));

  app.use((req, res, next) => {
    logToFile(`[HTTP] ${req.method} ${req.url} - IP: ${req.ip}`);
    next();
  });

  logToFile("[SERVER] Application starting...");

  // JWT Verification Middleware
  const verifyToken = (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "未授权访问" });
    }

    const token = authHeader.substring(7);
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
      next();
    } catch (e: any) {
      logToFile(`[AUTH ERROR] Token verification failed: ${e.message}`);
      return res.status(401).json({ error: "无效的令牌" });
    }
  };

  // Initialize DB Schema
  if (!process.env.DATABASE_URL) {
    logToFile("[DB WARNING] DATABASE_URL is not set in environment variables! Auth endpoints might fail.");
  } else {
    pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    `).then(() => {
      logToFile("[DB] PostgreSQL users table ready.");
      // Add updated_at column if it doesn't exist (migration)
      // Use DO block for compatibility with older PostgreSQL versions
      return pool.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'users' AND column_name = 'updated_at'
          ) THEN
            ALTER TABLE users ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
          END IF;
        END $$;
      `);
    }).then(() => logToFile("[DB] Database schema migration completed."))
      .catch(e => {
        const errorDetail = e?.message || e?.stack || JSON.stringify(e);
        logToFile(`[DB ERROR] Failed to init DB: ${errorDetail}`);
      });
  }

  // --- Auth Routes ---
  app.post("/api/auth/send-code", async (req, res) => {
    const { email, type } = req.body; // type: 'register' | 'reset'
    logToFile(`[AUTH DEBUG] Received send-code request for: ${email}, type: ${type}`);

    if (!email) {
      logToFile(`[AUTH ERROR] Send-code failed: Email missing`);
      return res.status(400).json({ error: "邮箱不能为空" });
    }

    // Check if user exists
    try {
      const { rowCount } = await pool.query('SELECT 1 FROM users WHERE email = $1', [email]);
      const userExists = rowCount && rowCount > 0;

      if (type === 'register' && userExists) {
        logToFile(`[AUTH ERROR] Send-code failed: Email ${email} already registered`);
        return res.status(400).json({ error: "该邮箱已被注册，请直接登录" });
      }

      if (type === 'reset' && !userExists) {
        logToFile(`[AUTH ERROR] Send-code failed: Email ${email} not found for password reset`);
        return res.status(400).json({ error: "该邮箱未注册" });
      }
    } catch (e: any) {
      logToFile(`[AUTH ERROR] Database check failed: ${e.message}`);
      return res.status(500).json({ error: "服务器错误" });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes
    verificationCodes.set(email, { code, expiresAt });

    logToFile(`[AUTH] >>> VERIFICATION CODE for ${email}: ${code} <<< (Expires in 5m)`);

    // Try to send email if SMTP is configured, but don't fail if it doesn't work
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      try {
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST || "smtp.ethereal.email",
          port: parseInt(process.env.SMTP_PORT || "587"),
          secure: process.env.SMTP_PORT === "465",
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        });

        await transporter.sendMail({
          from: `"愿力AI" <${process.env.SMTP_USER}>`,
          to: email,
          subject: type === 'reset' ? "密码重置 - 验证码" : "用户注册 - 验证码",
          html: `<p>您的${type === 'reset' ? '密码重置' : '注册'}验证码是：<strong>${code}</strong>。该验证码有效时间为 5 分钟。请勿泄露给他人。</p>`,
        });
        logToFile(`[AUTH] Verification email sent to ${email}`);
      } catch (e: any) {
        logToFile(`[AUTH WARNING] Failed to send email (${e.message}), but code is still valid. Check logs for code.`);
      }
    } else {
      logToFile("[AUTH] SMTP not configured. Verification code printed above.");
    }

    res.json({ message: "验证码已发送（开发环境请查看后端日志）" });
  });

  app.post("/api/auth/register", async (req, res) => {
    const { email, password, code } = req.body;
    logToFile(`[AUTH DEBUG] Register attempt for ${email} with code [${code}]`);
    
    if (!email || !password || !code) {
      logToFile(`[AUTH ERROR] Register failed: Missing fields (Email: ${!!email}, Pass: ${!!password}, Code: ${!!code})`);
      return res.status(400).json({ error: "缺少必要信息 (邮箱/密码/验证码)" });
    }

    const record = verificationCodes.get(email);
    logToFile(`[AUTH DEBUG] Found record for ${email}: ${JSON.stringify(record)}`);

    if (!record) {
      logToFile(`[AUTH ERROR] Register failed: No code record for ${email}. Please call send-code first.`);
      return res.status(400).json({ error: "请先获取验证码" });
    }

    // Use String() to ensure type-safe comparison
    if (String(record.code).trim() !== String(code).trim()) {
      logToFile(`[AUTH ERROR] Register failed: Code mismatch for ${email}. Expected [${record.code}], received [${code}]`);
      return res.status(400).json({ error: "验证码错误" });
    }

    if (Date.now() > record.expiresAt) {
      logToFile(`[AUTH ERROR] Register failed: Code expired for ${email}`);
      return res.status(400).json({ error: "验证码已过期" });
    }

    try {
      const { rowCount } = await pool.query('SELECT 1 FROM users WHERE email = $1', [email]);
      if (rowCount && rowCount > 0) {
        logToFile(`[AUTH ERROR] Register failed: Email ${email} already exists`);
        return res.status(400).json({ error: "该邮箱已被注册" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const result = await pool.query(
        'INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id, email',
        [email, hashedPassword]
      );
      const newUser = result.rows[0];

      // Clear verification code
      verificationCodes.delete(email);

      logToFile(`[AUTH] User registered successfully: ${email} (DB ID: ${newUser.id})`);
      
      // Generate token
      const token = jwt.sign({ id: newUser.id, email: newUser.email }, JWT_SECRET, { expiresIn: '7d' });
      res.json({ message: "注册成功", token, user: { id: newUser.id, email: newUser.email } });
    } catch (e: any) {
      logToFile(`[AUTH ERROR] Register DB execution error: ${e.message}`);
      res.status(500).json({ error: "注册失败，服务器内部错误" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;
    logToFile(`[AUTH DEBUG] Login attempt for: ${email}`);
    
    if (!email || !password) {
      logToFile(`[AUTH ERROR] Login failed: Missing email or password`);
      return res.status(400).json({ error: "请输入邮箱和密码" });
    }

    try {
      const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
      if (result.rows.length === 0) {
        logToFile(`[AUTH ERROR] Login failed: User ${email} not found in database`);
        return res.status(400).json({ error: "用户不存在或密码错误" });
      }

      const user = result.rows[0];
      const validPassword = await bcrypt.compare(password, user.password);
      
      logToFile(`[AUTH DEBUG] Password validation result for ${email}: ${validPassword}`);

      if (!validPassword) {
        logToFile(`[AUTH ERROR] Login failed: Password mismatch for ${email}`);
        return res.status(400).json({ error: "用户不存在或密码错误" });
      }

      logToFile(`[AUTH] User login success: ${email}`);
      
      const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
      res.json({ message: "登录成功", token, user: { id: user.id, email: user.email } });
    } catch (e: any) {
      logToFile(`[AUTH ERROR] Login DB execution error: ${e.message}`);
      res.status(500).json({ error: "登录失败，服务器内部错误" });
    }
  });

  // Reset password
  app.post("/api/auth/reset-password", async (req, res) => {
    const { email, code, newPassword } = req.body;
    logToFile(`[AUTH DEBUG] Reset password attempt for ${email}`);

    if (!email || !code || !newPassword) {
      logToFile(`[AUTH ERROR] Reset password failed: Missing fields`);
      return res.status(400).json({ error: "缺少必要信息" });
    }

    const record = verificationCodes.get(email);
    if (!record) {
      logToFile(`[AUTH ERROR] Reset password failed: No code record for ${email}`);
      return res.status(400).json({ error: "请先获取验证码" });
    }

    if (String(record.code).trim() !== String(code).trim()) {
      logToFile(`[AUTH ERROR] Reset password failed: Code mismatch for ${email}`);
      return res.status(400).json({ error: "验证码错误" });
    }

    if (Date.now() > record.expiresAt) {
      logToFile(`[AUTH ERROR] Reset password failed: Code expired for ${email}`);
      return res.status(400).json({ error: "验证码已过期" });
    }

    try {
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      const result = await pool.query(
        'UPDATE users SET password = $1, updated_at = CURRENT_TIMESTAMP WHERE email = $2 RETURNING id, email',
        [hashedPassword, email]
      );

      if (result.rows.length === 0) {
        logToFile(`[AUTH ERROR] Reset password failed: User ${email} not found`);
        return res.status(400).json({ error: "用户不存在" });
      }

      verificationCodes.delete(email);
      logToFile(`[AUTH] Password reset successful for ${email}`);
      res.json({ message: "密码重置成功，请使用新密码登录" });
    } catch (e: any) {
      logToFile(`[AUTH ERROR] Reset password DB error: ${e.message}`);
      res.status(500).json({ error: "密码重置失败，服务器内部错误" });
    }
  });

  // Get user profile (protected route)
  app.get("/api/auth/profile", verifyToken, async (req: any, res) => {
    try {
      const result = await pool.query('SELECT id, email, created_at FROM users WHERE id = $1', [req.user.id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "用户不存在" });
      }
      res.json({ user: result.rows[0] });
    } catch (e: any) {
      logToFile(`[AUTH ERROR] Profile fetch error: ${e.message}`);
      res.status(500).json({ error: "获取用户信息失败" });
    }
  });

  // Helper to handle AI interaction
  const safeGenerateContent = async (prompt: string, schema?: Schema, apiKey?: string | null, maxRetries = 3) => {
    // Using a more stable and powerful model for structured output
    const MODEL_NAME = "gemini-3.1-flash-lite-preview";
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent`;
    
    // Choose the best key
    const effectiveKey = (apiKey || process.env.GEMINI_API_KEY || "key").trim();
    
    // Set up dispatcher for undici proxy agent
    const dispatcher = process.env.https_proxy ? new ProxyAgent(process.env.https_proxy) : undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        logToFile(`[AI] Calling ${API_URL} (Attempt ${attempt + 1})...`);
        
        // Add 120s timeout protection
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 120000); // 120 seconds

        try {
          const response = await undiciFetch(API_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': effectiveKey
            },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: prompt }] }],
              generationConfig: { 
                responseMimeType: "application/json",
                responseSchema: schema
              }
            }),
            dispatcher: dispatcher,
            signal: controller.signal
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            throw new Error(`API error: ${response.status} ${await response.text()}`);
          }

          const data = await response.json();
          // @ts-ignore
          const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
          
          if (!content) {
            logToFile(`[AI] ${API_URL} returned empty content.`);
            throw new Error("Empty response from AI");
          }
          
          // Strip markdown code blocks if present
          const cleanedContent = content.replace(/^```json\s*/, '').replace(/\s*```$/, '');
          
          logToFile(`[AI] ${MODEL_NAME} response received (${cleanedContent.length} chars)`);
          return { text: cleanedContent };
        } catch (fetchError: any) {
          clearTimeout(timeoutId);
          if (fetchError.name === 'AbortError') {
            throw new Error("AI request timed out (120s)");
          }
          throw fetchError;
        }
      } catch (error: any) {
        logToFile(`[AI ERROR] Attempt ${attempt + 1} failed: ${error.message || JSON.stringify(error)}`);
        if (attempt === maxRetries) throw error;
        const delayMs = Math.pow(2, attempt + 1) * 1000;
        logToFile(`[AI] Retrying in ${delayMs}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
    throw new Error("Failed to generate content after max retries.");
  };

  // 2. Define Node 1: Character Extraction
  const extractCharactersNode = async (state: typeof ScriptState.State) => {
    logToFile("[NODE] characterExtraction starting...");
    if (state.error) return state;
    try {
      const promptTemplate = fs.readFileSync(path.join(__dirname, 'prompts', 'extract_characters.md'), 'utf-8');
      // Add title request to character extraction or as a preamble
      const p = "Please also suggest a short creative title for this script. " + promptTemplate;
      const prompt = p.replace('{{scriptContent}}', state.scriptContent);

      const schema: Schema = {
        type: Type.OBJECT,
        properties: {
          suggestedTitle: { type: Type.STRING },
          characters: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                baseName: { type: Type.STRING },
                states: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      name: { type: Type.STRING },
                      visualPrompt: { type: Type.STRING }
                    }
                  }
                }
              }
            }
          }
        }
      };

      const response = await safeGenerateContent(prompt, schema, state.apiKey);
      const rawData = JSON.parse(response.text || "{\"characters\":[], \"suggestedTitle\": \"Untitled\"}");
      
      const charactersMap: Record<string, any[]> = {};
      if (rawData.characters && Array.isArray(rawData.characters)) {
        for (const char of rawData.characters) {
          if (char.baseName && char.states) {
            charactersMap[char.baseName] = char.states;
          }
        }
      }

      return { 
        characters: charactersMap, 
        suggestedTitle: rawData.suggestedTitle || "Untitled Script" 
      };
    } catch (e: any) {
      logToFile(`[CHAR ERROR] ${e.message || e}`);
      return { error: `Failed to extract characters: ${e.message || "Unknown error"}` };
    }
  };

  // 3. Define Node 2: Scene Extraction
  const extractScenesNode = async (state: typeof ScriptState.State) => {
    logToFile("[NODE] sceneExtraction starting...");
    if (state.error) return state;
    try {
      const promptTemplate = fs.readFileSync(path.join(__dirname, 'prompts', 'extract_scenes.md'), 'utf-8');
      const prompt = promptTemplate.replace('{{scriptContent}}', state.scriptContent);

      const schema: Schema = {
        type: Type.OBJECT,
        properties: {
          scenes: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                location: { type: Type.STRING },
                states: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      stateName: { type: Type.STRING },
                      aliases: { type: Type.STRING },
                      visualPrompt: { type: Type.STRING }
                    }
                  }
                }
              }
            }
          }
        }
      };

      const response = await safeGenerateContent(prompt, schema, state.apiKey);
      const rawData = JSON.parse(response.text || "{\"scenes\":[]}");
      
      const scenesMap: Record<string, any[]> = {};
      if (rawData.scenes && Array.isArray(rawData.scenes)) {
        for (const sc of rawData.scenes) {
          if (sc.location && sc.states) {
            scenesMap[sc.location] = sc.states;
          }
        }
      }

      return { scenes: scenesMap };
    } catch (e: any) {
      logToFile(`[SCENE ERROR] ${e.message || e}`);
      return { error: `Failed to extract scenes: ${e.message || "Unknown error"}` };
    }
  };

  // 4. Define Node 3: Prop Extraction
  const extractPropsNode = async (state: typeof ScriptState.State) => {
    logToFile("[NODE] propExtraction starting...");
    if (state.error) return state;
    try {
      const promptTemplate = fs.readFileSync(path.join(__dirname, 'prompts', 'extract_props.md'), 'utf-8');
      const prompt = promptTemplate.replace('{{scriptContent}}', state.scriptContent);

      const schema: Schema = {
        type: Type.OBJECT,
        properties: {
          props: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                baseName: { type: Type.STRING },
                states: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      scene: { type: Type.STRING },
                      state: { type: Type.STRING },
                      aliases: { type: Type.STRING },
                      description: { type: Type.STRING },
                      material: { type: Type.STRING },
                      color: { type: Type.STRING },
                      visualPrompt: { type: Type.STRING }
                    }
                  }
                }
              }
            }
          }
        }
      };

      const response = await safeGenerateContent(prompt, schema, state.apiKey);
      const rawData = JSON.parse(response.text || "{\"props\":[]}");
      
      const propsMap: Record<string, any[]> = {};
      if (rawData.props && Array.isArray(rawData.props)) {
        for (const p of rawData.props) {
          if (p.baseName && p.states) {
            propsMap[p.baseName] = p.states;
          }
        }
      }

      return { props: propsMap };
    } catch (e: any) {
      logToFile(`[PROP ERROR] ${e.message || e}`);
      return { error: `Failed to extract props: ${e.message || "Unknown error"}` };
    }
  };

  // 5. Define Node 4: Storyboard Generation
  const generateStoryboardNode = async (state: typeof ScriptState.State) => {
    logToFile("[NODE] storyboardGeneration starting...");
    if (state.error) return state;
    try {
      // Build structured asset reference list for precise replacement
      const lines: string[] = [];
      lines.push("可用资产列表（生成提示词时，涉及以下人物、场景、物品，必须使用对应的引用格式，严禁使用原始名称）：");
      lines.push("");

      // Characters
      const charEntries: string[] = [];
      Object.entries(state.characters).forEach(([name, states]: [string, any]) => {
        states.forEach((s: any) => {
          const stateName = s.name || s.state;
          const fullName = `${name} - ${stateName}`;
          const visual = s.visualPrompt || s.description || "";
          charEntries.push(`- @[${fullName}.png] — ${visual}`);
        });
      });
      if (charEntries.length > 0) {
        lines.push("【人物资产】（必须使用以下精确引用格式）：");
        charEntries.forEach(e => lines.push(e));
        lines.push("");
      }

      // Scenes
      const sceneEntries: string[] = [];
      Object.entries(state.scenes).forEach(([name, states]: [string, any]) => {
        states.forEach((s: any) => {
          const stateName = s.stateName || s.state;
          const fullName = stateName ? `${name} - ${stateName}` : name;
          const visual = s.visualPrompt || s.description || "";
          sceneEntries.push(`- @[${fullName}.png] — ${visual}`);
        });
      });
      if (sceneEntries.length > 0) {
        lines.push("【场景资产】（必须使用以下精确引用格式）：");
        sceneEntries.forEach(e => lines.push(e));
        lines.push("");
      }

      // Props
      const propEntries: string[] = [];
      Object.entries(state.props).forEach(([name, states]: [string, any]) => {
        states.forEach((s: any) => {
          const stateName = s.stateName || s.state;
          const fullName = stateName ? `${name} - ${stateName}` : name;
          const visual = s.visualPrompt || s.description || "";
          propEntries.push(`- @[${fullName}.png] — ${visual}`);
        });
      });
      if (propEntries.length > 0) {
        lines.push("【物品资产】（必须使用以下精确引用格式）：");
        propEntries.forEach(e => lines.push(e));
        lines.push("");
      }

      lines.push("【强制引用规则】：");
      lines.push("1. 只要镜头描述中出现了上述资产列表中的任何人物、场景或物品，必须将其完整名称替换为对应的 @[资产全称.png] 格式。");
      lines.push("2. 示例：'林越坐在沙发上' 必须写成 '@[林越 - 居家通话状态.png] 坐在 @[林越家客厅.png] 的沙发上'。");
      lines.push("3. 严禁使用括号标注状态（如'林越（居家通话状态）'），必须使用 @[...] 引用格式。");
      lines.push("4. 人物的状态差异通过不同的 .png 文件区分，不要在一个引用中混用多个状态。");

      const context = lines.join("\n");
      
      const promptTemplate = fs.readFileSync(path.join(__dirname, 'prompts', 'generate_storyboard.md'), 'utf-8');
      const prompt = promptTemplate
        .replace('{{context}}', context)
        .replace('{{scriptContent}}', state.scriptContent);

      const schema: Schema = {
        type: Type.OBJECT,
        properties: {
          storyboard: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                description: { type: Type.STRING, description: "本镜头的画面内容概述（20-50字），包含场景状态、角色状态、关键物品状态、动作方向性及对白摘要" },
                firstFramePrompt: { type: Type.STRING, description: "起始帧画面描述（50-100字），包含场景状态+光线氛围+角色外貌与具体状态+物品具体状态与位置+动作起始姿态+镜头起始景别与角度+画面风格。涉及Assets Context中的人物/物品/场景时，使用 @[资产名称.png] 格式引用" },
                lastFramePrompt: { type: Type.STRING, description: "结束帧画面描述（50-100字），包含角色状态变化+物品状态/位置变化+动作/表情完成后的状态+镜头运动到位后的景别与构图。涉及Assets Context中的人物/物品/场景时，使用 @[资产名称.png] 格式引用" },
                videoPrompt: { type: Type.STRING, description: "从起始帧到结束帧的连续运动描述，包含镜头运动方式与节奏+角色动作过程（明确发起者与承受者）+物品交互过程（明确流向）。原文出现的对白必须逐字完整嵌入，格式为：角色名（状态描述）说：'对白原话'。涉及Assets Context中的人物/物品/场景时，使用 @[资产名称.png] 格式引用" },
                associatedCharacters: { 
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                },
                associatedProps: { 
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                }
              },
              required: ["description", "firstFramePrompt", "lastFramePrompt", "videoPrompt"]
            }
          }
        },
        required: ["storyboard"]
      };

      const response = await safeGenerateContent(prompt, schema, state.apiKey);
      const data = JSON.parse(response.text || "{\"storyboard\":[]}");
      
      return { storyboard: data.storyboard || [] };
    } catch (e: any) {
      logToFile(`[STORY ERROR] ${e.message || e}`);
      return { error: `Failed to generate storyboard: ${e.message || "Unknown error"}` };
    }
  };

  // 6. Construct the Graph
  const workflow = new StateGraph(ScriptState)
    .addNode("extractChars", extractCharactersNode)
    .addNode("extractScenes", extractScenesNode)
    .addNode("extractProps", extractPropsNode)
    .addNode("generateStoryboard", generateStoryboardNode)
    .addEdge(START, "extractChars")
    .addEdge("extractChars", "extractScenes")
    .addEdge("extractScenes", "extractProps")
    .addEdge("extractProps", "generateStoryboard")
    .addEdge("generateStoryboard", END);

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server });

  logToFile("[SERVER] WebSocket Server initialized.");

  wss.on("connection", (ws, req) => {
    const ip = req.socket.remoteAddress;
    // Extract key from header if present
    const authHeader = req.headers.authorization;
    let wsApiKey: string | null = null;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      wsApiKey = authHeader.substring(7);
      logToFile(`[WS] Auth token detected in handshake (Len: ${wsApiKey.length})`);
    }

    logToFile(`[WS] New connection from ${ip}`);

    ws.on("message", async (message) => {
      const msgStr = message.toString();
      // Skip logging heartbeats
      if (msgStr === "ping" || msgStr === "pong" || msgStr.toLowerCase().includes('"ping"') || msgStr.toLowerCase().includes('"pong"')) {
        return;
      }
      
      logToFile(`[WS RECV] ${msgStr}`);
      
      try {
        const { action, payload } = JSON.parse(msgStr);
        
        // 1. Handle Script Parsing via WebSocket
        if (action === "PARSE_SCRIPT") {
          const { scriptContent, projectId, apiKey: payloadApiKey } = payload;
          const taskId = `task_ws_${Date.now()}`;
          const finalApiKey = payloadApiKey || wsApiKey;
          
          logToFile(`[WS TASK] Starting script parse for task: ${taskId}. Key source: ${payloadApiKey ? 'payload' : (wsApiKey ? 'handshake' : 'env')}`);
          
          // Send ACK
          pushToFrontend(ws, "ACK", { status: "ok", taskId });
          
            // Run processing in background
          (async () => {
            try {
              logToFile(`[WS TASK] Running extraction nodes in parallel...`);
              const initialState = { scriptContent, apiKey: finalApiKey } as any;
              
              // Start heartbeat
              const heartbeat = setInterval(() => {
                pushToFrontend(ws, "TASK_HEARTBEAT", {
                  status: "processing",
                  message: "正在后台稳健运行中..."
                });
              }, 30000);

              const [charRes, sceneRes, propRes] = await Promise.all([
                extractCharactersNode(initialState),
                extractScenesNode(initialState),
                extractPropsNode(initialState)
              ]);

              if (charRes.error || sceneRes.error || propRes.error) {
                clearInterval(heartbeat);
                throw new Error(charRes.error || sceneRes.error || propRes.error);
              }

              logToFile("[WS TASK] Extraction complete. Starting storyboard...");
              const storyboardRes = await generateStoryboardNode({
                scriptContent,
                apiKey: finalApiKey,
                suggestedTitle: charRes.suggestedTitle,
                characters: charRes.characters,
                scenes: sceneRes.scenes,
                props: propRes.props
              } as any);

              clearInterval(heartbeat);
              if (storyboardRes.error) throw new Error(storyboardRes.error);

              pushToFrontend(ws, "SCRIPT_PARSED", {
                projectId: projectId || "NEW_DRAFT",
                suggestedTitle: charRes.suggestedTitle || "未命名剧本",
                data: {
                  characters: charRes.characters,
                  scenes: sceneRes.scenes,
                  props: propRes.props,
                  storyboard: storyboardRes.storyboard
                }
              });
              
              logToFile(`[WS TASK] Successfully completed task: ${taskId}`);
            } catch (err: any) {
              logToFile(`[WS TASK ERROR] Task ${taskId} failed: ${err.message}`);
              pushToFrontend(ws, "ERROR", { message: `AI 解析失败：${err.message}` });
            }
          })();
        }

        // 2. Handle Asset/Scene Generation
        if (action === "START_ASSET_GEN" || action === "START_SCENE_GEN") {
          const targetId = payload.stateId || payload.sceneId || payload.targetId;
          const entityId = payload.entityId;
          let progress = 0;
          const interval = setInterval(() => {
            progress += 20;
            if (progress <= 100) {
              pushToFrontend(ws, "PROGRESS_UPDATE", { entityId, targetId, status: "generating", progress });
            }
            if (progress >= 100) {
              clearInterval(interval);
              pushToFrontend(ws, action === "START_ASSET_GEN" ? "TASK_COMPLETED" : "SCENE_COMPLETED", {
                entityId, targetId, status: "completed", progress: 100, 
                resultUrl: `https://picsum.photos/seed/${targetId}/1024/1024`
              });
            }
          }, 1000);
        }
      } catch (e) {
        logToFile(`[WS ERROR] Processing error: ${e}`);
      }
    });

    ws.on("close", () => {
      logToFile(`[WS] Connection closed from ${ip}`);
    });

    ws.on("error", (err) => {
      logToFile(`[WS ERROR] Socket error from ${ip}: ${err.message}`);
    });
  });

  const scriptEngine = workflow.compile();

  // --- WebSocket Helpers ---
  function pushToFrontend(client: WebSocket, eventName: string, data: any) {
    if (client.readyState === WebSocket.OPEN) {
      logToFile(`[WS PUSH] Event: ${eventName}`);
      client.send(JSON.stringify({
        event: eventName,
        payload: data
      }));
    }
  }

  // --- API Routes ---

  app.post("/api/v1/script/parse", async (req, res) => {
    logToFile("[API] Received POST /api/v1/script/parse");
    const { scriptContent, clientId } = req.body;
    const authHeader = req.headers.authorization;
    
    if (!authHeader?.startsWith("Bearer ")) {
      logToFile("[API ERROR] 401 Unauthorized - Missing or invalid Bearer token");
      return res.status(401).json({ error: "Unauthorized" });
    }

    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const apiKeyFromHeader = authHeader.substring(7);
    logToFile(`[API] Task accepted: ${taskId}. Key from header used.`);
    
    // Return success immediately to avoid HTTP timeout
    res.json({ status: "accepted", taskId });

    // Push ACK to WebSocket
    wss.clients.forEach((client) => {
      pushToFrontend(client, "ACK", { status: "ok", taskId });
    });

    // Asynchronous background execution
    (async () => {
      try {
        logToFile(`[TASK] Starting background script parsing for task: ${taskId}`);
        
        // Parallelize character/scene/prop extraction to save time
        logToFile("[TASK] Running extraction nodes in parallel...");
        const [charRes, sceneRes, propRes] = await Promise.all([
          extractCharactersNode({ scriptContent } as any),
          extractScenesNode({ scriptContent } as any),
          extractPropsNode({ scriptContent } as any)
        ]);

        if (charRes.error || sceneRes.error || propRes.error) {
          throw new Error(charRes.error || sceneRes.error || propRes.error);
        }

        logToFile("[TASK] Parallel extraction complete. Starting storyboard generation...");
        
        // Final storyboard node follows
        const storyboardRes = await generateStoryboardNode({
          scriptContent,
          suggestedTitle: charRes.suggestedTitle,
          characters: charRes.characters,
          scenes: sceneRes.scenes,
          props: propRes.props
        } as any);

        if (storyboardRes.error) {
          throw new Error(storyboardRes.error);
        }

        // Notify via WebSocket
        wss.clients.forEach((client) => {
          pushToFrontend(client, "SCRIPT_PARSED", { 
            projectId: clientId || "NEW_DRAFT",
            suggestedTitle: charRes.suggestedTitle || "未命名剧本",
            data: {
              characters: charRes.characters,
              scenes: sceneRes.scenes,
              props: propRes.props,
              storyboard: storyboardRes.storyboard
            }
          });
        });

        logToFile(`[TASK] Successfully completed task: ${taskId}`);
      } catch (error: any) {
        logToFile(`[TASK ERROR] Task ${taskId} failed: ${error.message || error}`);
        wss.clients.forEach((client) => {
          pushToFrontend(client, "ERROR", { message: `AI 解析引擎处理失败：${error.message || "未知错误"}` });
        });
      }
    })();
  });

  // --- WebSocket & Static Assets (Existing logic) ---
  
  if (process.env.NODE_ENV === "production") {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api/")) return next();
      res.sendFile(path.join(distPath, "index.html"));
    });
  } else {
    app.get("/", (req, res) => res.json({ status: "ok", message: "Script Parser Backend is active" }));
  }

  server.listen(PORT, "0.0.0.0", () => {
    logToFile(`[SERVER] Backend API Server running on port ${PORT}`);
  });
}

startServer();
