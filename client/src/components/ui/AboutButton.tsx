import React, { useState } from 'react';
import { Tooltip, Button } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import AboutModal from './AboutModal';

interface AboutButtonProps {
  className?: string;
}

const AboutButton: React.FC<AboutButtonProps> = ({ className = '' }) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Tooltip title="关于">
        <Button
          type="text"
          aria-label="关于"
          onClick={() => setOpen(true)}
          className={[
            // 与 ThemeToggle 完全一致
            'flex items-center justify-center w-9 h-9 rounded-md transition-colors',
            'text-gray-600 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700',
            className,
          ].join(' ')}
          icon={<InfoCircleOutlined />}
        />
      </Tooltip>

      <AboutModal open={open} onClose={() => setOpen(false)} />
    </>
  );
};

export default AboutButton;
