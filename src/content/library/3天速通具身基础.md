---
title: 3天速通具身基础
date: 2026-09-21
updated: 2026-09-21
description: 本文旨在设立一个roadmap，用于在短时间建立对具身的基本认识
tags:
  - robotics
draft: false
type: tool
author: kai
status: todo
---

# 具身智能实验室入组前 2–3 天速通知识清单

> 目标：不是在 2–3 天内“学会具身智能”，而是快速建立一套足够用的知识框架，使自己：能听懂实验室里大部分常见术语；能看懂一个具身项目从硬件、数据到训练与部署的大致流程；能初步判断一项工作为什么可能成为论文；知道后续应该沿哪些方向继续深入。

***

## 0. 总体目标

完成这份清单后，希望至少达到下面三个层次：

### A. 会听懂

- 机器人基础
- Manipulation
- Perception / Tactile
- Robot Learning

### B. 会看懂项目

- 数据怎么来
- Policy 怎么训练
- Robot 怎么执行
- 怎么评价成功
- 为什么会失败

### C. 会看懂科研

- Paper 怎么读
- Idea 怎么来
- Experiment 怎么设计
- 什么叫 Contribution
- 什么叫 Baseline / Ablation
- Paper 怎么写、怎么投
- 哪些 Venue 值得关注

***

# 1. 具身智能全景认知

## 需要了解

- 什么是 Embodied AI / Embodied Intelligence
- 什么是 Robot Learning
- 具身智能与以下方向的关系：
    - 传统机器人学
    - Computer Vision
    - Reinforcement Learning
    - Imitation Learning
    - Large Language Model
    - Multimodal Learning
- 具身系统的基本闭环：

```plain
Perception
   ↓
State / Observation
   ↓
Policy / Planning
   ↓
Action
   ↓
Robot / Environment
   ↓
Feedback
   └────────→ Perception

```

## 达标要求

能够自己解释：

> 一个具身智能系统，本质上如何从“看到环境”到“做出动作”，再根据结果继续调整？

***

# 2. 机器人基础知识

## 必须认识的概念

### 机器人本体

- Robot Arm
- Manipulator
- End Effector
- Gripper
- Dexterous Hand
- Joint
- Degree of Freedom（DoF）

### 状态与运动

- Joint Space
- Cartesian Space
- Position
- Orientation
- Pose
- Trajectory

### 运动学

- Forward Kinematics
- Inverse Kinematics

### 控制

- Position Control
- Velocity Control
- Torque Control
- Force Control
- Impedance Control
- Control Frequency

## 当前阶段要求

不需要推复杂公式。

重点是：

- 看到这些词不会完全陌生；
- 知道它们大概在机器人系统的哪一层；
- 能理解机械臂为什么不能只靠“神经网络输出一个位置”就完成所有控制。

***

# 3. Manipulation 基础

## 常见任务

- Grasping
- Pick-and-Place
- Pushing
- Peg Insertion
- Assembly
- Tool Use
- In-hand Manipulation
- Contact-rich Manipulation

## 需要理解的问题

- 什么是 Open-loop Control
- 什么是 Closed-loop Control
- 什么是 Contact
- 什么是 Contact-rich Task
- 为什么抓取比普通目标检测难
- 为什么灵巧操作比普通夹爪抓取更难
- 为什么现实世界 manipulation 存在大量不确定性

## 达标要求

看到一个机器人任务时，能够初步判断：

- 输入是什么？
- 输出是什么？
- 难点是什么？
- 是否涉及接触？
- 是否需要实时反馈？

***

# 4. 感知与触觉

这是与当前实验室项目关联度很高的一部分。

## 视觉

了解：

- RGB
- Depth
- RGB-D
- Point Cloud
- Camera Calibration
- Object Pose Estimation

## 本体感知

了解：

- Proprioception
- Joint Position
- Joint Velocity
- Motor Current
- Force / Torque

## 触觉

了解：

- Tactile Sensor
- Force Sensor
- Vision-based Tactile Sensor
- GelSight 类传感器
- Contact Detection
- Slip Detection
- Force Estimation

## 多模态融合

理解：

```plain
Vision
   +
Tactile
   +
Proprioception
   ↓
Multimodal Representation
   ↓
Policy

```

## 核心问题

重点想清楚：

> 为什么仅靠视觉不够？

例如：

- 遮挡
- 视觉定位误差
- 接触发生后难以直接观察
- 摩擦力不可直接从 RGB 图像中准确得到
- 柔性物体状态难以仅靠视觉估计

进一步理解：

> 触觉真正提供了什么额外信息？

***

# 5. Robot Learning 基础

这是后续读论文时最重要的一组概念。

## 基本术语

必须认识：

- State
- Observation
- Action
- Policy
- Trajectory
- Episode
- Reward
- Dataset

基本关系：

```plain
Observation
    ↓
 Policy
    ↓
 Action

```

***

## Behavior Cloning

理解：

```plain
Human Demonstrations
        ↓
    Dataset
        ↓
Supervised Learning
        ↓
      Policy

```

需要知道：

- 它本质上类似监督学习；
- 模型学习“人在这种情况下会采取什么动作”。

***

## Imitation Learning

需要知道：

- Behavior Cloning 属于 Imitation Learning 的重要方法；
- 数据通常来自人类示范、遥操作或已有策略。

***

## Reinforcement Learning

需要理解：

```plain
State
 ↓
Action
 ↓
Environment
 ↓
Reward
 ↓
Policy Update

```

了解：

- Online RL
- Offline RL

不要求现在推 PPO / SAC 等公式。

***

## Diffusion Policy

至少理解：

- Diffusion Model 不只可以生成图片；
- 它也可以用于生成机器人动作序列；
- Diffusion Policy 已成为 manipulation 中非常重要的一类方法。

当前阶段重点理解：

> 为什么可以把“未来的一段动作”看成需要生成的数据？

***

# 6. 数据与真实机器人 Pipeline

这一部分对于判断自己进组后到底在干什么非常重要。

## 一个典型流程

```plain
Task Definition
      ↓
Data Collection
      ↓
Data Cleaning
      ↓
Dataset
      ↓
Training
      ↓
Validation
      ↓
Robot Deployment
      ↓
Real-world Evaluation
      ↓
Failure Analysis
      ↓
Collect More Data / Modify Model

```

## Data Collection

认识：

- Teleoperation
- Demonstration
- Human Demonstration
- Robot Trajectory
- Episode
- Success / Failure Data

思考：

- 一条数据到底包含什么？
- Observation 是什么？
- Action 是什么？
- Frequency 是多少？
- 是否包含 tactile？
- 是否包含 camera？
- 是否包含 robot proprioception？

***

## Evaluation

了解：

- Success Rate
- Task Completion
- Precision
- Robustness
- Generalization

必须意识到：

> Demo 能跑一次，不等于系统有效。

通常需要：

```plain
N 次实验
↓
Success / Failure
↓
统计指标

```

***

# 7. 当前值得认识的前沿方向

当前阶段不要求深入算法，只要求知道：

> 这个方向想解决什么问题？

***

## 7.1 Vision-Language-Action（VLA）

大致结构：

```plain
Image
 +
Language
 +
Robot State
   ↓
Large Model
   ↓
Robot Action

```

关注问题：

- 大模型能否直接控制机器人？
- Internet-scale knowledge 能否迁移到机器人？
- 如何实现跨任务泛化？

***

## 7.2 Robot Foundation Model

理解：

> 是否可以像训练 GPT 一样，用大量机器人数据训练一个通用机器人模型？

关注：

- Scaling
- Cross-robot
- Cross-task
- Generalization

***

## 7.3 Diffusion / Flow Policy

关注：

- 动作序列生成
- 多峰动作分布
- Manipulation policy

***

## 7.4 World Model

核心思想：

```plain
Current State
 +
Action
 ↓
Predict Future State

```

理解：

> 如果机器人可以预测“这样做之后世界会变成什么样”，它就可能提前规划。

***

## 7.5 Dexterous Manipulation

关键词：

- Dexterous Hand
- Multi-finger Manipulation
- In-hand Manipulation
- Contact-rich Manipulation

核心难点：

- 高自由度
- 接触复杂
- 控制困难
- 数据难采
- Sim2Real 难

***

## 7.6 Tactile Learning

关注：

- Tactile Representation
- Vision-Tactile Fusion
- Contact Estimation
- Slip Detection
- Tactile Policy

与你当前看到的实验室项目高度相关。

***

## 7.7 Data Scaling

核心问题：

> Robot Learning 的数据是否也存在 Scaling Law？

思考：

- 数据多是否一定更好？
- 数据 diversity 是否比数量更重要？
- 如何降低机器人数据采集成本？

***

## 7.8 Generalization

机器人是否能从：

```plain
训练过的物体
↓
没见过的物体

```

或者：

```plain
训练任务
↓
新任务

```

甚至：

```plain
机器人 A
↓
机器人 B

```

***

## 7.9 Sim2Real

理解：

```plain
Simulation
   ↓
Training
   ↓
Real Robot

```

核心问题：

> 为什么仿真里训练好的机器人，到了现实世界会失效？

认识：

- Reality Gap
- Domain Randomization
- Sim2Real Transfer

***

# 8. 科研与论文体系

这一部分与“会不会写代码”同样重要。

***

## 8.1 学术生态

理解以下概念：

- Conference
- Journal
- Workshop
- arXiv
- Preprint
- Peer Review

***

# 9. 具身 / 机器人主要 Venue

## Robotics Conference

至少认识：

### ICRA

IEEE International Conference on Robotics and Automation

### IROS

IEEE/RSJ International Conference on Intelligent Robots and Systems

### RSS

Robotics: Science and Systems

### CoRL

Conference on Robot Learning

***

## Robotics Journal

认识：

- IEEE Robotics and Automation Letters（RA-L）
- IEEE Transactions on Robotics（T-RO）
- International Journal of Robotics Research（IJRR）
- Science Robotics

***

## AI / ML / CV 交叉 Venue

机器人相关工作也经常出现在：

- NeurIPS
- ICML
- ICLR
- CVPR
- ICCV
- ECCV

注意：

> 在机器人 / AI 领域，顶级 Conference 的重要性非常高，不要套用“期刊一定比会议高级”的传统认知。

***

# 10. 如何评价一篇论文

阅读时关注：

## Problem

作者到底想解决什么问题？

## Motivation

为什么这个问题值得解决？

## Limitation

以前的方法哪里不行？

## Method

作者到底改了什么？

## Contribution

论文真正新增了什么？

## Experiment

实验是否真的支持作者的结论？

## Generalization

是否只在一个简单场景中有效？

***

# 11. 一篇机器人论文的大致结构

```plain
Abstract

Introduction

Related Work

Method

Experiments

Results / Discussion

Conclusion

```

读论文时不一定从第一页顺序读到最后一页。

建议优先：

```plain
Abstract
↓
Introduction
↓
Figures / Videos
↓
Experiment
↓
Method
↓
Related Work

```

***

# 12. Research Gap 是什么

必须避免一个错误：

> “以前没人做过” ≠ “这是一个好 Research Problem”

真正有价值的 Research Gap 通常来自：

- Existing Method Failure
- Poor Generalization
- High Cost
- Low Data Efficiency
- Poor Robustness
- Slow Inference
- Weak Multimodal Fusion
- Sim2Real Gap
- Hardware Limitation

***

# 13. Baseline 与 SOTA

## Baseline

回答：

> 如果不用我的新方法，会怎么样？

## SOTA

State of the Art

即当前效果较强的已有方法。

论文通常需要证明：

```plain
Our Method
vs
Baselines
vs
Existing Strong Methods

```

***

# 14. Ablation Study

Ablation 的核心思想：

> 把你的方法拆开，验证到底是哪一部分有效。

例如：

你的方法：

```plain
Vision
+
Tactile
+
New Fusion Module

```

可以测试：

```plain
Vision Only

Vision + Tactile

Vision + Tactile + New Fusion

```

从而证明：

> 性能提升到底是不是来自你的新模块。

***

# 15. 从项目到论文

非常重要。

工程项目可能只是：

```plain
Make Robot Work

```

论文需要：

```plain
Problem
↓
Hypothesis
↓
Method
↓
Experiment
↓
Evidence
↓
Contribution

```

例如：

### 工程问题

机械臂定位不准。

↓

### Observation

柔性手指可能可以被动吸收定位误差。

↓

### Research Question

柔性结构是否能够降低 grasp 对视觉定位精度的要求？

↓

### Hypothesis

一定范围内，柔性结构可以增加系统 tolerance。

↓

### Experiment

控制：

- 定位误差
- 手指刚度
- 物体种类

测：

- Grasp Success Rate

↓

### Paper Contribution

形成可以量化验证的结论。

***

# 16. 投稿流程

认识整个流程：

```plain
Idea
 ↓
Literature Review
 ↓
Method
 ↓
Experiment
 ↓
Writing
 ↓
Submission
 ↓
Peer Review
 ↓
Rebuttal
 ↓
Accept / Reject
 ↓
Camera Ready

```

不要把“写论文”理解成最后几天写 Word / LaTeX。

真正的大部分工作发生在：

```plain
Idea
+
Experiment Design
+
Experiment

```

***

# 17. 文献阅读方法

推荐路径：

```plain
Survey
↓
Representative Papers
↓
References
↓
Cited By
↓
Recent Papers

```

而不是：

```plain
打开 arXiv
↓
随机点论文
↓
看到哪篇读哪篇

```

***

# 18. 科研工具与习惯

需要逐渐建立：

- Zotero
- Git / GitHub
- Experiment Log
- README
- Dataset Version
- Model Checkpoint
- Weights & Biases / TensorBoard
- Paper Notes

每次实验记录：

```plain
Experiment ID

Hypothesis

Code Version

Dataset Version

Parameters

Result

Observation

Conclusion

Next Step

```

***

# 19. 进实验室后如何判断自己的工作

以后学长给任务时，不要只问：

> 我要做什么？

还要试着理解：

### 这个任务在 Pipeline 哪一层？

```plain
Hardware
Perception
Data
Model
Policy
Control
Evaluation

```

### 它服务于哪个 Research Question？

### 它是：

- 重复性劳动
- 工程实现
- 实验支持
- 算法开发
- Research Contribution

### 自己是否能逐渐接触：

- 数据采集
- 数据处理
- 模型训练
- Robot Deployment
- Evaluation
- Failure Analysis

理想状态不是：

```plain
一直负责一个固定机械劳动

```

而是逐渐变成：

```plain
执行任务
↓
理解 Pipeline
↓
理解 Problem
↓
提出改进
↓
负责一个 Sub-problem
↓
形成自己的 Experiment

```

***

# 20. 特别值得训练的科研思维

以后如果学长说：

> 今天采 500 条数据。

不要只想到：

```plain
今天要采 500 条。

```

尝试多想一层：

```plain
为什么是 500 条？

一条数据包括什么？

Observation 是什么？

Action 是什么？

数据 frequency 是多少？

Task distribution 是什么？

Dataset diversity 如何保证？

Policy 用什么方法训练？

Success Rate 怎么定义？

Failure case 有哪些？

500 条是否足够？

真正的 Research Question 是什么？

```

这就是从：

```plain
“完成任务”

```

逐渐转向：

```plain
“理解科研”

```

***

# 21. 当前与你实验室最相关的重点

根据目前接触到的方向，建议优先级：

## 第一优先级

- Robot Manipulation
- Tactile Sensing
- Vision-Tactile Fusion
- Imitation Learning
- Behavior Cloning
- Diffusion Policy
- Robot Data Collection

## 第二优先级

- Dexterous Manipulation
- Flexible / Soft Robotic Hand
- Sim2Real
- Generalization
- Multimodal Learning

## 第三优先级

- VLA
- Robot Foundation Model
- World Model
- Reinforcement Learning

***

# 22. 2–3 天后的理想状态

如果别人讨论：

> “这个 task 现在主要是 teleop 采 demonstration，用 vision + proprioception 做 diffusion policy，后面可能加 tactile modality，看 unseen objects 上 success rate 能不能提升。”

你至少应该能够拆成：

```plain
Task
→ Manipulation

Teleop
→ 数据采集

Demonstration
→ 模仿学习数据

Vision + Proprioception
→ Observation

Diffusion Policy
→ Policy Model

Tactile
→ 新增感知模态

Unseen Objects
→ Generalization

Success Rate
→ Evaluation Metric

```

不要求立刻知道：

> Diffusion Policy 的网络结构具体怎么实现。

但应该知道：

> 他们到底在讨论什么问题。

***

# 23. 最终知识地图

```plain
Embodied Intelligence
│
├── Robotics
│   ├── Kinematics
│   ├── Control
│   └── Hardware
│
├── Perception
│   ├── Vision
│   ├── Depth
│   ├── Proprioception
│   └── Tactile
│
├── Manipulation
│   ├── Grasp
│   ├── Pick-and-Place
│   ├── Contact-rich
│   └── Dexterous Manipulation
│
├── Robot Learning
│   ├── Behavior Cloning
│   ├── Imitation Learning
│   ├── Reinforcement Learning
│   └── Diffusion Policy
│
├── Frontier
│   ├── VLA
│   ├── Foundation Model
│   ├── World Model
│   ├── Tactile Learning
│   ├── Data Scaling
│   ├── Generalization
│   └── Sim2Real
│
└── Research
    ├── Literature Review
    ├── Research Gap
    ├── Baseline
    ├── Ablation
    ├── Experiment
    ├── Paper
    └── Publication

```

***

# 24. 当前阶段的核心原则

不要追求：

> “每个概念都彻底学懂。”

而应该追求：

> “建立地图，知道每个东西在哪里。”

后续真正进入项目后，再沿着具体任务深入。

对于当前阶段：

```plain
广度 > 深度
结构化认知 > 零散知识
理解 Pipeline > 背算法
理解 Research Question > 单纯完成任务

```
