import React from 'react';
import { Button } from 'antd';
import { StopOutlined } from '@ant-design/icons';

interface StopGenerationButtonProps {
  /** 是否显示按钮 */
  visible: boolean;
  /** 点击停止生成的回调函数 */
  onStop: () => void;
  /** 按钮是否禁用 */
  disabled?: boolean;
  /** 自定义样式类名 */
  className?: string;
}

/**
 * 停止生成按钮组件
 * 用于中断AI消息生成过程
 */
const StopGenerationButton: React.FC<StopGenerationButtonProps> = ({
  visible,
  onStop,
  disabled = false,
  className = '',
}) => {
  if (!visible) {
    return null;
  }

  return (
    <Button
      type="default"
      size="small"
      icon={<StopOutlined />}
      onClick={onStop}
      disabled={disabled}
      className={`
        flex items-center gap-1 px-3 py-1 
        bg-red-50 border-red-200 text-red-600 
        hover:bg-red-100 hover:border-red-300 hover:text-red-700
        focus:bg-red-100 focus:border-red-300 focus:text-red-700
        disabled:bg-gray-50 disabled:border-surface disabled:text-gray-400
        transition-all duration-200 ease-in-out
        shadow-sm hover:shadow-md
        ${className}
      `}
      style={{
        borderRadius: '6px',
        fontSize: '12px',
        height: '28px',
        lineHeight: '1',
      }}
    >
      停止生成
    </Button>
  );
};

export default StopGenerationButton;
