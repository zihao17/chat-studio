import React, { useState, useRef, useEffect } from "react";
import { Select } from "antd";
import { RobotOutlined } from "@ant-design/icons";

const { Option } = Select;

// 模型配置接口
export interface ModelConfig {
  id: string;
  name: string;
  provider: string;
  description: string;
  category: "dashscope" | "modelscope" | "openai";
}

// 可用模型列表
export const AVAILABLE_MODELS: ModelConfig[] = [
  // 阿里百炼 DashScope 模型
  {
    id: "qwen3-max",
    name: "Qwen3 Max",
    provider: "阿里百炼",
    description: "通义千问3代超大规模语言模型，适合复杂推理",
    category: "dashscope",
  },
  {
    id: "qwen-flash-2025-07-28",
    name: "Qwen3 Flash",
    provider: "阿里百炼",
    description: "通义千问3代快速版，响应迅速",
    category: "dashscope",
  },
  {
    id: "qwen3-vl-flash",
    name: "Qwen3 VL Flash",
    provider: "阿里百炼",
    description: "通义千问3代视觉语言模型，支持图像理解",
    category: "dashscope",
  },
  {
    id: "deepseek-v3.2-exp",
    name: "DeepSeek V3.2 Exp",
    provider: "阿里百炼",
    description: "DeepSeek实验版模型，探索前沿AI能力",
    category: "dashscope",
  },
  // 魔搭社区 ModelScope 模型
  {
    id: "Qwen/Qwen3-Next-80B-A3B-Instruct",
    name: "Qwen3 Next 80B",
    provider: "魔搭社区",
    description: "通义千问3代80B参数模型，性能强劲",
    category: "modelscope",
  },
  {
    id: "ZhipuAI/GLM-4.5",
    name: "GLM-4.5",
    provider: "魔搭社区",
    description: "智谱AI GLM-4.5模型，支持多模态对话",
    category: "modelscope",
  },
  // OpenAI 模型（暂无可用）
];

interface ModelSelectorProps {
  value?: string;
  onChange?: (modelId: string) => void;
  disabled?: boolean;
  size?: "small" | "middle" | "large";
  className?: string;
}

/**
 * 模型选择器组件
 * 支持多个AI服务商的模型切换
 */
const ModelSelector: React.FC<ModelSelectorProps> = ({
  value = "qwen3-max",
  onChange,
  disabled = false,
  size = "middle",
  className = "",
}) => {
  // 控制下拉菜单的显示状态
  const [open, setOpen] = useState(false);
  // 当前悬停的选项ID
  const [hoveredOption, setHoveredOption] = useState<string | null>(null);
  // 延迟隐藏的定时器引用
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, []);

  // 根据服务商分组模型
  const groupedModels = AVAILABLE_MODELS.reduce((groups, model) => {
    const provider = model.provider;
    if (!groups[provider]) {
      groups[provider] = [];
    }
    groups[provider].push(model);
    return groups;
  }, {} as Record<string, ModelConfig[]>);

  // 确保OpenAI分组始终存在（即使为空）
  if (!groupedModels["OpenAI"]) {
    groupedModels["OpenAI"] = [];
  }

  // 获取当前选中模型的信息
  const currentModel = AVAILABLE_MODELS.find((model) => model.id === value);

  // 获取当前悬停模型的信息
  const hoveredModel = hoveredOption
    ? AVAILABLE_MODELS.find((model) => model.id === hoveredOption)
    : null;

  // 显示的模型信息（优先显示悬停的，否则显示当前选中的）
  const displayModel = hoveredModel || currentModel;

  // 处理鼠标进入选择器
  const handleMouseEnter = () => {
    if (!disabled) {
      // 清除可能存在的隐藏定时器
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = null;
      }
      setOpen(true);
    }
  };

  // 处理鼠标离开选择器
  const handleMouseLeave = () => {
    // 设置延迟隐藏定时器
    hideTimeoutRef.current = setTimeout(() => {
      setOpen(false);
      setHoveredOption(null);
    }, 300); // 延迟300毫秒
  };

  // 处理选项悬停
  const handleOptionMouseEnter = (optionId: string) => {
    setHoveredOption(optionId);
  };

  // 处理选项鼠标离开
  const handleOptionMouseLeave = () => {
    setHoveredOption(null);
  };

  return (
    <div onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      <Select
        value={value}
        onChange={onChange}
        disabled={disabled}
        size={size}
        open={open}
        onDropdownVisibleChange={setOpen}
        className={`model-selector ${className}`}
        placeholder="选择AI模型"
        suffixIcon={<RobotOutlined />}
        dropdownRender={(menu) => (
          <div className="model-selector-dropdown">
            {menu}
            {displayModel && (
              <div className="px-3 py-2 border-t border-gray-100 bg-gray-50">
                <div className="text-xs text-gray-500">
                  <div className="font-medium">{displayModel.name}</div>
                  <div className="mt-1">{displayModel.description}</div>
                </div>
              </div>
            )}
          </div>
        )}
      >
        {Object.entries(groupedModels).map(([provider, models]) => (
          <Select.OptGroup key={provider} label={provider}>
            {models.length > 0 ? (
              models.map((model) => (
                <Option
                  key={model.id}
                  value={model.id}
                  onMouseEnter={() => handleOptionMouseEnter(model.id)}
                  onMouseLeave={handleOptionMouseLeave}
                >
                  <div className="flex items-center justify-between">
                    <span>{model.name}</span>
                    <span className="text-xs text-gray-400 ml-2">
                      {model.category === "dashscope" && "百炼"}
                      {model.category === "modelscope" && "魔搭"}
                      {model.category === "openai" && "OpenAI"}
                    </span>
                  </div>
                </Option>
              ))
            ) : (
              <Option key={`${provider}-empty`} value="" disabled>
                <span className="text-gray-400 italic">暂无可用模型</span>
              </Option>
            )}
          </Select.OptGroup>
        ))}
      </Select>
    </div>
  );
};

export default ModelSelector;
