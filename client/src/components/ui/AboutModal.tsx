import React from 'react';
import { Modal, Typography, Divider } from 'antd';

interface AboutModalProps {
  open: boolean;
  onClose: () => void;
}

const AboutModal: React.FC<AboutModalProps> = ({ open, onClose }) => {
  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={640}
      title={<div className="text-foreground text-xl font-bold">关于 Chat Studio</div>}
    >
      <div className="space-y-5 text-foreground">
        {/* 项目简介 */}
        <div>
          <div className="text-sm font-semibold mb-2">项目简介</div>
          <div className="space-y-1 text-sm leading-6">
            <div>
              <span className="font-medium">定位：</span>
              面向开发者与团队的 AI 对话工作台，主打高效创作与协作。
            </div>
            <div>
              <span className="font-medium">技术栈：</span>
              React + TypeScript + Vite + Ant Design + Tailwind CSS；Node.js + Express。
            </div>
            <div>
              <span className="font-medium">亮点：</span>
              多模型切换、会话管理、亮暗主题、Markdown/代码高亮、可调参数。
            </div>
          </div>
        </div>

        {/* 网站与仓库（3 行） */}
        <div>
          <div className="text-sm font-semibold mb-2">网站</div>
          <div className="space-y-1 text-sm leading-6">
            <div>
              <span className="font-medium">网站1：</span>
              <Typography.Link href="https://ChatStudio.cn" target="_blank" rel="noreferrer" className="break-all">
                https://ChatStudio.cn
              </Typography.Link>
            </div>
            <div>
              <span className="font-medium">网站2：</span>
              <Typography.Link href="https://chat-studio-pzh.vercel.app" target="_blank" rel="noreferrer" className="break-all">
                https://chat-studio-pzh.vercel.app
              </Typography.Link>
            </div>
            <div>
              <span className="font-medium">GitHub：</span>
              <Typography.Link href="https://github.com/zihao17/chat-studio" target="_blank" rel="noreferrer" className="break-all">
                https://github.com/zihao17/chat-studio
              </Typography.Link>
            </div>
          </div>
        </div>

        <Divider className="my-2" />

        {/* 开发者信息 */}
        <div>
          <div className="text-sm font-semibold mb-2">开发者信息</div>
          <div className="text-sm leading-6">
            <span className="font-medium">姓名：</span>
            Zihao Pu
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default AboutModal;

