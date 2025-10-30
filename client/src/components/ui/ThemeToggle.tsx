import React from 'react';
import { Button, Tooltip } from 'antd';
import { BulbOutlined } from '@ant-design/icons';
import { useTheme } from '../../contexts/ThemeContext';

const ThemeToggle: React.FC<{ className?: string } & React.ComponentProps<'button'>> = ({ className }) => {
  const { isDark, toggle } = useTheme();

  return (
    <Tooltip title={isDark ? '切换为亮色' : '切换为暗色'}>
      <Button
        type="text"
        aria-label="切换主题"
        onClick={toggle}
        className={`
          flex items-center justify-center w-9 h-9 rounded-md transition-colors
          text-gray-600 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700
          ${className || ''}
        `}
        icon={<BulbOutlined />}
      />
    </Tooltip>
  );
};

export default ThemeToggle;

