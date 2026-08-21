# ChatUI + RAG 企业文档知识库助手

基于开源 ChatUI（Next.js）二次开发的**企业文档问答系统**：将企业制度、项目资料、技术文档统一管理，用户用自然语言提问即可获得带出处的回答，所有模型**本地私有化部署**，数据不出内网。

## 功能特性

- **RAG 知识库问答** — 文档上传后自动完成解析、分块、向量化，提问时检索相关片段注入提示词，显著降低幻觉
- **混合检索** — 向量语义检索（BGE-M3）+ BM25 关键词检索，RRF 融合排序
- **重排序** — bge-reranker-v2-m3 对候选片段二次打分，过滤低相关结果
- **流式输出** — SSE 逐字返回，支持思考过程展示
- **多知识库管理** — 文档上传 / 删除 / 下载 / 预览
- **外部模型连接管理** — 界面上配置并切换不同的 LLM 提供方
- **本地部署** — 配合 LM Studio 运行本地模型，无需外部 API

## 系统架构

```
浏览器
  └─ ChatUI 前端（Next.js, :3002）   聊天界面 / 知识库管理
       └─ rag-server 后端（FastAPI, :8000）   RAG 检索 / 文档处理
            └─ LM Studio（:1234）   本地模型服务（LLM + Embedding）
```

## RAG 处理流程

| 阶段 | 方案 |
| --- | --- |
| 文档解析 | MarkItDown（PDF/Word/Markdown），RapidOCR 提取图片文字 |
| 内容清洗 | ftfy 编码修复 + 正则去噪 |
| 文本分块 | LangChain 两级切分：标题切分 + 字符切分（1000/重叠 200） |
| 向量化 | BGE-M3（LM Studio 提供） |
| 向量存储 | ChromaDB |
| 检索 | 混合检索（语义 + BM25），RRF 融合，相似度阈值过滤 |
| 重排序 | bge-reranker-v2-m3（Cross-Encoder） |
| 生成 | 检索结果注入 system prompt，SSE 流式返回 |

## 技术栈

| 层 | 技术 |
| --- | --- |
| 前端 | Next.js 16 / React 19 / TypeScript / Tailwind CSS |
| 后端 | Python / FastAPI / LangChain / ChromaDB / jieba + BM25Okapi |
| 模型 | Qwen（LLM，LM Studio 本地部署）/ BGE-M3（Embedding）/ bge-reranker-v2-m3（Reranker） |

## 快速开始

```bash
# 前端
npm install
npm run dev        # http://localhost:3002

# 后端（独立仓库，私有）
# rag-server：FastAPI 服务，python main.py 启动于 :8000
# LM Studio：加载 LLM 与 Embedding 模型，开启本地服务 :1234
```

## 说明

- 本项目基于开源项目 [ChatUI](https://github.com/imelanthirayan/ChatUI)（MIT License）二次开发，保留其原始 License
- RAG 后端服务为独立私有仓库，包含文档解析、混合检索、重排序等完整实现，可联系查看
