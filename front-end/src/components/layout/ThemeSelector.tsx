import React from 'react';
import { Moon, Flower, Sun, Cloud, Palette } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

export const ThemeSelector: React.FC<{ 
  onThemeChange: (theme: string) => void;
  currentTheme: string;
}> = ({ onThemeChange, currentTheme }) => {
  const themes = [
    { name: '暗夜', value: 'night', icon: Moon, color: 'bg-[#0a0a0c]' },
    { name: '粉樱', value: 'pink', icon: Flower, color: 'bg-[#1a0f18]' },
    { name: '深空', value: 'dark', icon: Cloud, color: 'bg-[#080808]' },
    { name: '明亮', value: 'light', icon: Sun, color: 'bg-[#ffffff]' },
  ];

  const CurrentIcon = themes.find(t => t.value === currentTheme)?.icon || Moon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <div className="h-8 w-8 rounded-full cursor-pointer hover:bg-secondary flex items-center justify-center">
          <CurrentIcon className="w-4 h-4" />
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-[#121212] border border-secondary text-foreground">
        {themes.map(theme => (
          <DropdownMenuItem 
            key={theme.value} 
            onClick={() => onThemeChange(theme.value)}
            className="flex items-center gap-2 cursor-pointer"
          >
            <theme.icon className="w-4 h-4" />
            {theme.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
