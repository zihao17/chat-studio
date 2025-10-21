/**
 * 配置检测路由
 * 提供API密钥配置状态查询接口
 */

const express = require("express");
const {
  checkApiKeyConfiguration,
  getAvailableServices,
} = require("../utils/keyManager");
const router = express.Router();

/**
 * GET /api/config/services - 获取可用的AI服务列表
 * 返回当前配置下可用的AI服务类型
 */
router.get("/services", (req, res) => {
  try {
    const availableServices = getAvailableServices();
    const config = checkApiKeyConfiguration();

    res.json({
      success: true,
      data: {
        availableServices,
        configuration: {
          hasUserModelscope: config.hasUserModelscope,
          hasDashscope: config.hasDashscope,
          hasOpenai: config.hasOpenai,
          usingFallback: config.usingFallback,
        },
      },
    });
  } catch (error) {
    console.error("获取服务配置失败:", error);
    res.status(500).json({
      success: false,
      message: "获取服务配置失败",
    });
  }
});

/**
 * GET /api/config/models - 获取可用的模型列表
 * 根据当前配置返回可用的模型
 */
router.get("/models", (req, res) => {
  try {
    const availableServices = getAvailableServices();
    const config = checkApiKeyConfiguration();

    // 定义各服务的模型列表
    const serviceModels = {
      dashscope: [
        {
          id: "qwen3-max",
          name: "Qwen3 Max",
          provider: "阿里百炼",
          description: "阿里超万亿参数旗舰模型，能力最强，适合复杂任务",
          category: "dashscope",
        },
        {
          id: "qwen-flash-2025-07-28",
          name: "Qwen3 Flash",
          provider: "阿里百炼",
          description: "轻量化快速模型，响应速度快如闪电",
          category: "dashscope",
        },
        {
          id: "qwen3-vl-flash",
          name: "Qwen3 VL Flash",
          provider: "阿里百炼",
          description: "轻量级视觉语言模型，OCR理解快准稳",
          category: "dashscope",
        },
      ],
      modelscope: [
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
      ],
      openai: [
        // OpenAI模型列表（如果需要的话）
      ],
    };

    // 根据可用服务筛选模型
    const availableModels = [];
    availableServices.forEach((service) => {
      if (serviceModels[service]) {
        availableModels.push(...serviceModels[service]);
      }
    });

    res.json({
      success: true,
      data: {
        models: availableModels,
        configuration: {
          hasUserModelscope: config.hasUserModelscope,
          hasDashscope: config.hasDashscope,
          hasOpenai: config.hasOpenai,
          usingFallback: config.usingFallback,
        },
      },
    });
  } catch (error) {
    console.error("获取模型列表失败:", error);
    res.status(500).json({
      success: false,
      message: "获取模型列表失败",
    });
  }
});

module.exports = router;
