import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const { setTheme, theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Button variant="outline" size="icon" className="w-9 h-9">
        <Sun className="h-[1.2rem] w-[1.2rem]" />
        <span className="sr-only">Toggle theme</span>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          size="icon" 
          className="w-9 h-9 relative overflow-hidden group bg-white/10 dark:bg-gray-900/20 backdrop-blur-md border-white/20 dark:border-gray-700/50 hover:bg-white/20 dark:hover:bg-gray-800/30 transition-all duration-300"
        >
          <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0 absolute" />
          <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
          
          {/* Beautiful gradient background animation */}
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-pink-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 animate-pulse" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="end" 
        className="glass dark:dark-card-gradient border-white/20 dark:border-gray-700/50 shadow-2xl dark:dark-shadow backdrop-blur-xl"
      >
        <DropdownMenuItem 
          onClick={() => setTheme("light")}
          className="cursor-pointer hover:bg-blue-50/50 dark:hover:bg-purple-500/20 transition-all duration-200 group"
        >
          <Sun className="mr-2 h-4 w-4 group-hover:text-blue-600 dark:group-hover:text-purple-400 transition-colors" />
          <span className="group-hover:text-blue-700 dark:group-hover:text-purple-300 transition-colors">Light</span>
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => setTheme("dark")}
          className="cursor-pointer hover:bg-blue-50/50 dark:hover:bg-purple-500/20 transition-all duration-200 group"
        >
          <Moon className="mr-2 h-4 w-4 group-hover:text-blue-600 dark:group-hover:text-purple-400 transition-colors" />
          <span className="group-hover:text-blue-700 dark:group-hover:text-purple-300 transition-colors">Dark</span>
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => setTheme("system")}
          className="cursor-pointer hover:bg-blue-50/50 dark:hover:bg-purple-500/20 transition-all duration-200 group"
        >
          <Monitor className="mr-2 h-4 w-4 group-hover:text-blue-600 dark:group-hover:text-purple-400 transition-colors" />
          <span className="group-hover:text-blue-700 dark:group-hover:text-purple-300 transition-colors">System</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}














