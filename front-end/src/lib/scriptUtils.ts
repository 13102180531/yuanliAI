export const normalizeEntities = (entities: any, type: 'character' | 'scene' | 'prop') => {
  if (!entities) return [];
  if (Array.isArray(entities)) return entities;
  
  return Object.entries(entities).map(([name, states]: [string, any], index) => {
    let parsedStates = states;
    if (!Array.isArray(parsedStates)) {
      if (typeof parsedStates === 'object' && parsedStates !== null) {
         const values = Object.values(parsedStates);
         if (values.length > 0 && typeof values[0] === 'object') {
           parsedStates = values;
         } else {
           parsedStates = [parsedStates];
         }
      } else {
         parsedStates = [];
      }
    }

    return {
      id: `${type.toUpperCase()}_${index}`,
      name,
      type,
      basePrompt: parsedStates[0]?.appearance || parsedStates[0]?.visualPrompt || parsedStates[0]?.description || parsedStates[0]?.name || '',
      states: parsedStates.map((s: any, sIdx: number) => ({
        stateId: `${type.toUpperCase()}_${index}_STATE_${sIdx}`,
        stateName: s.name || s.state || s.stateName || s.aliases || '基础状态',
        isBaseState: sIdx === 0,
        promptModifier: s.appearance || s.visualPrompt || s.description || s.name || '',
        status: 'empty' as const,
        progress: 0,
        imageUrl: null
      }))
    };
  });
};

export const normalizeStoryboard = (storyboardData: any, assets?: { characters: any[], scenes: any[], props: any[] }) => {
  let rawList = storyboardData;
  if (rawList && !Array.isArray(rawList) && typeof rawList === 'object') {
    // Attempt to find the array inside (e.g. { scenes: [...] } or { storyboard: [...] })
    rawList = rawList.storyboard || rawList.scenes || rawList.nodes || rawList.items || Object.values(rawList).find(v => Array.isArray(v)) || [];
  }

  return (Array.isArray(rawList) ? rawList : []).map((node: any, index: number) => {
    const finalPrompt = `${node.scene_name || ''} ${node.scene_state || ''}. ${node.action || ''}`;
    let enhancedPrompt = finalPrompt;

    const characterIds: string[] = [];
    let sceneId = '';
    const propIds: string[] = [];

    if (assets) {
      // Auto-bind characters
      assets.characters.forEach(c => {
        if (finalPrompt.includes(c.name)) {
          // Use base state or first state
          if (c.states && c.states.length > 0) {
            characterIds.push(c.states[0].stateId);
          }
          if (!enhancedPrompt.includes(`@[${c.name}.png]`)) {
            const regex = new RegExp(c.name, 'g');
            enhancedPrompt = enhancedPrompt.replace(regex, `@[${c.name}.png]`);
          }
        }
      });

      // Auto-bind scenes
      assets.scenes.forEach(s => {
        if (finalPrompt.includes(s.name)) {
          if (s.states && s.states.length > 0) {
            sceneId = s.states[0].stateId;
          }
          if (!enhancedPrompt.includes(`@[${s.name}.png]`)) {
            const regex = new RegExp(s.name, 'g');
            enhancedPrompt = enhancedPrompt.replace(regex, `@[${s.name}.png]`);
          }
        }
      });

      // Auto-bind props
      assets.props.forEach(p => {
        if (finalPrompt.includes(p.name)) {
          if (p.states && p.states.length > 0) {
            propIds.push(p.states[0].stateId);
          }
          if (!enhancedPrompt.includes(`@[${p.name}.png]`)) {
            const regex = new RegExp(p.name, 'g');
            enhancedPrompt = enhancedPrompt.replace(regex, `@[${p.name}.png]`);
          }
        }
      });
    }

    return {
      id: `NODE_${index}`,
      sceneNumber: index + 1,
      actionDesc: node.action || '',
      scene_name: node.scene_name,
      scene_state: node.scene_state,
      firstFramePrompt: node.firstFramePrompt,
      lastFramePrompt: node.lastFramePrompt,
      videoPrompt: node.videoPrompt,
      associatedCharacters: node.associatedCharacters,
      associatedProps: node.associatedProps,
      boundAssets: {
        characterIds,
        sceneId,
        propIds
      },
      finalPrompt: enhancedPrompt,
      status: 'idle' as const,
      resultUrl: null,
      firstFrameUrl: null,
      lastFrameUrl: null,
      videoUrl: null
    };
  });
};
