import React from "react";
import { Modal, Slider, InputNumber, Input, Tooltip, Space } from "antd";
import { InfoCircleOutlined } from "@ant-design/icons";
import { useChatContext } from "../../contexts/ChatContext";
import { DEFAULT_SYSTEM_PROMPT_PLACEHOLDER } from "../../types/chat";

interface ChatAdvancedSettingsModalProps {
  open: boolean;
  onClose: () => void;
}

const ChatAdvancedSettingsModal: React.FC<ChatAdvancedSettingsModalProps> = ({
  open,
  onClose,
}) => {
  const {
    temperature,
    topP,
    systemPrompt,
    setTemperature,
    setTopP,
    setSystemPrompt,
  } = useChatContext();

  const clampRange = (v: number) => {
    if (Number.isNaN(v)) return 0.7;
    return Math.min(1.0, Math.max(0.1, v));
  };
  const round1 = (v: number) => Math.round(v * 10) / 10;

  return (
    <Modal
      open={open}
      onCancel={onClose}
      onOk={onClose}
      title="聊天高级设置"
      width={720}
      okText="完成"
      cancelText="取消"
    >
      <div className="space-y-6 pt-2">
        {/* Temperature */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-gray-800 font-medium">温度</span>
            <Tooltip title="温度（Temperature）：控制回答的随机程度。值越小，输出越确定、可预测；值越大，输出越具有创造力，但也更跳跃（默认值为0.7）">
              <InfoCircleOutlined className="text-gray-400" />
            </Tooltip>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>更确定</span>
                <span>更创意</span>
              </div>
              <Slider
                min={0.1}
                max={1.0}
                step={0.1}
                value={round1(temperature)}
                onChange={(v) => setTemperature(round1(clampRange(Number(v))))}
              />
            </div>
            <InputNumber
              min={0.1}
              max={1.0}
              step={0.1}
              precision={1}
              value={round1(temperature)}
              onChange={(v) => setTemperature(round1(clampRange(Number(v))))}
              stringMode={false}
              style={{ width: 100 }}
            />
          </div>
        </div>

        {/* Top P */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-gray-800 font-medium">Top_P</span>
            <Tooltip title="Top_P：控制回答的词汇范围。值越小，越聚焦高概率词，回答更收敛；值越大，AI回复的词汇范围越大，越多样化（默认值为0.9）">
              <InfoCircleOutlined className="text-gray-400" />
            </Tooltip>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>更保守</span>
                <span>更开放</span>
              </div>
              <Slider
                min={0.1}
                max={1.0}
                step={0.1}
                value={round1(topP)}
                onChange={(v) => setTopP(round1(clampRange(Number(v))))}
              />
            </div>
            <InputNumber
              min={0.1}
              max={1.0}
              step={0.1}
              precision={1}
              value={round1(topP)}
              onChange={(v) => setTopP(round1(clampRange(Number(v))))}
              stringMode={false}
              style={{ width: 100 }}
            />
          </div>
        </div>

        {/* System Prompt */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-gray-800 font-medium">系统提示词</span>
            <Tooltip title="为模型设定角色与行为边界。留空则不发送系统提示词。">
              <InfoCircleOutlined className="text-gray-400" />
            </Tooltip>
          </div>
          <Space direction="vertical" className="w-full">
            <Input.TextArea
              value={systemPrompt}
              onChange={(e) => {
                const v = e.target.value;
                if (v.trim() === "") {
                  setSystemPrompt("");
                } else {
                  setSystemPrompt(v);
                }
              }}
              placeholder={DEFAULT_SYSTEM_PROMPT_PLACEHOLDER}
              autoSize={{ minRows: 4, maxRows: 10 }}
              className="!text-sm"
            />
          </Space>
        </div>
      </div>
    </Modal>
  );
};

export default ChatAdvancedSettingsModal;
