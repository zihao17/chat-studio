import React from "react";

interface Props {
  visible: boolean;
}

const DropOverlay: React.FC<Props> = ({ visible }) => {
  if (!visible) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/20">
      <div className="px-6 py-3 rounded-xl bg-white dark:bg-[#1f1f1f] border border-surface shadow-lg text-foreground">
        将文件拖拽到此处以上传
      </div>
    </div>
  );
};

export default DropOverlay;

