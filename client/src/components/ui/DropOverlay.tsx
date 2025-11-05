import React from "react";

interface Props {
  visible: boolean;
}

// 说明：该覆盖层应作为“聊天滚动容器”的子元素渲染，并依赖父容器的 relative 定位。
const DropOverlay: React.FC<Props> = ({ visible }) => {
  if (!visible) return null;
  return (
    <div
      className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none select-none \
                 backdrop-blur-md backdrop-saturate-150"
    >
      <div className="text-center space-y-2">
        <div className="font-semibold text-foreground text-lg md:text-xl tracking-wide transition-colors">
          拖放添加文件
        </div>
        <div className="text-gray-500 dark:text-gray-400 text-xs md:text-sm transition-colors">
          文件数量：最多 3 个，文件类型：txt、word
        </div>
      </div>
    </div>
  );
};

export default DropOverlay;
