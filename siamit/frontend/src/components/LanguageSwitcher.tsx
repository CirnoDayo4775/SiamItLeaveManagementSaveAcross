
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Globe } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const LanguageSwitcher = () => {
  const { i18n } = useTranslation();

  const changeLanguage = (language: string) => {
    i18n.changeLanguage(language);
    localStorage.setItem('i18nextLng', language);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          <Globe className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-white dark:bg-gray-800 border shadow-lg dark:border-gray-700">
        <DropdownMenuItem
          onClick={() => changeLanguage('th')}
          className={`cursor-pointer dark:text-gray-200 dark:focus:bg-gray-700 ${i18n.language === 'th' ? 'bg-blue-100 text-blue-700 font-bold dark:bg-blue-900/30 dark:text-blue-300' : ''}`}
        >
          ไทย {i18n.language === 'th' && '✔️'}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => changeLanguage('en')}
          className={`cursor-pointer dark:text-gray-200 dark:focus:bg-gray-700 ${i18n.language === 'en' ? 'bg-blue-100 text-blue-700 font-bold dark:bg-blue-900/30 dark:text-blue-300' : ''}`}
        >
          English {i18n.language === 'en' && '✔️'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default LanguageSwitcher;
