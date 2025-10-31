import React, { useState, useRef, useEffect } from "react";
import { Select, App } from "antd";
import { RobotOutlined } from "@ant-design/icons";
import { getAvailableModels } from "../../utils/configApi";

const { Option } = Select;

// 模型配置接口
export interface ModelConfig {
  id: string;
  name: string;
  provider: string;
  description: string;
  category: "dashscope" | "modelscope" | "openai";
}

// 默认可用模型列表（作为备用）
const DEFAULT_MODELS: ModelConfig[] = [
  // 魔搭社区模型（总是可用，因为有备用密钥）
  {
    id: "ZhipuAI/GLM-4.6",
    name: "GLM-4.6",
    provider: "魔搭社区",
    description: "智谱 355B旗舰模型，代码推理全能，上下文长达200K",
    category: "modelscope",
  },
  {
    id: "deepseek-ai/DeepSeek-R1-0528",
    name: "DeepSeek-R1",
    provider: "魔搭社区",
    description: "深度求索 671B 开源推理模型，推理能力强",
    category: "modelscope",
  },
  {
    id: "deepseek-ai/DeepSeek-V3.2-Exp",
    name: "DeepSeek-V3.2-Exp",
    provider: "魔搭社区",
    description: "实验性稀疏注意力模型，长文本效率飙升",
    category: "modelscope",
  },
  {
    id: "Qwen/Qwen3-235B-A22B",
    name: "Qwen3-235B",
    provider: "魔搭社区",
    description: "235B MoE 开源模型，混合思考模式，推理成本低",
    category: "modelscope",
  },
  {
    id: "Qwen/Qwen3-Next-80B-A3B-Instruct",
    name: "Qwen3 Next 80B",
    provider: "魔搭社区",
    description: "80B 超稀疏 MoE 模型，训练成本降90%，推理速度飙升",
    category: "modelscope",
  },
  {
    id: "Qwen/Qwen3-8B",
    name: "Qwen3-8B",
    provider: "魔搭社区",
    description: "阿里 8B 开源模型，适配中小场景，部署门槛低",
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
 * 支持多个AI服务商的模型切换，根据后端配置动态加载可用模型
 */
const ModelSelector: React.FC<ModelSelectorProps> = ({
  value = "Qwen/Qwen3-Next-80B-A3B-Instruct", // 默认使用Qwen Next 80B模型
  onChange,
  disabled = false,
  size = "middle",
  className = "",
}) => {
  // 使用 App.useApp() 获取 message 实例
  const { message } = App.useApp();
  // 控制下拉菜单的显示状态
  const [open, setOpen] = useState(false);
  // 当前悬停的选项ID
  const [hoveredOption, setHoveredOption] = useState<string | null>(null);
  // 延迟隐藏的定时器引用
  const hideTimeoutRef = useRef<number | null>(null);
  // 可用模型列表
  const [availableModels, setAvailableModels] = useState<ModelConfig[]>(DEFAULT_MODELS);
  // 加载状态
  const [loading, setLoading] = useState(false);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, []);

  // 组件挂载时获取可用模型
  useEffect(() => {
    const fetchAvailableModels = async () => {
      try {
        setLoading(true);
        const response = await getAvailableModels();
        if (response.success && response.data.models.length > 0) {
          setAvailableModels(response.data.models);
          
          // 如果用户使用备用密钥，显示提示
          if (response.data.configuration.usingFallback) {
            message.info('当前使用内置免费密钥，仅支持魔搭社区模型', 3);
          }
        }
      } catch (error) {
        console.error('获取可用模型失败:', error);
        message.warning('获取模型列表失败，使用默认模型');
        // 保持使用默认模型列表
      } finally {
        setLoading(false);
      }
    };

    fetchAvailableModels();
  }, []);

  // 根据服务商分组模型
  const groupedModels = availableModels.reduce((groups, model) => {
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
  const currentModel = availableModels.find((model) => model.id === value);

  // 获取当前悬停模型的信息
  const hoveredModel = hoveredOption
    ? availableModels.find((model) => model.id === hoveredOption)
    : null;
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
        disabled={disabled || loading}
        size={size}
        open={open}
        onDropdownVisibleChange={setOpen}
        className={`model-selector ${className}`}
        placeholder={loading ? "加载模型中..." : "选择AI模型"}
        suffixIcon={<RobotOutlined />}
        dropdownRender={(menu) => (
          <div className="model-selector-dropdown">
            {menu}
            {displayModel && (
              <div className="px-3 py-2 border-t border-surface bg-panel dark:bg-black">
                <div className="text-xs text-foreground">
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
