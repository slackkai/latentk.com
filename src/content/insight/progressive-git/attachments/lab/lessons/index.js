/**
 * 七课的总入口：给每个沙盒页面和测试脚本用。
 * 每个模块导出 config（页面配置）与 solution（标准解法命令序列）。
 */
import { config as firstRepo, solution as firstRepoSolution } from './01-first-repo.js';
import { config as branches, solution as branchesSolution } from './02-branches.js';
import { config as conflict, solution as conflictSolution } from './03-conflict.js';
import { config as clonePush, solution as clonePushSolution } from './04-clone-push.js';
import { config as pull, solution as pullSolution } from './05-pull.js';
import { config as undo, solution as undoSolution } from './06-undo.js';
import { config as rebase, solution as rebaseSolution } from './07-rebase.js';

export const lessons = [
  { id: '01-first-repo', sandbox: 'sandbox-1', config: firstRepo, solution: firstRepoSolution },
  { id: '02-branches', sandbox: 'sandbox-2', config: branches, solution: branchesSolution },
  { id: '03-conflict', sandbox: 'sandbox-3', config: conflict, solution: conflictSolution },
  { id: '04-clone-push', sandbox: 'sandbox-4', config: clonePush, solution: clonePushSolution },
  { id: '05-pull', sandbox: 'sandbox-5', config: pull, solution: pullSolution },
  { id: '06-undo', sandbox: 'sandbox-6', config: undo, solution: undoSolution },
  { id: '07-rebase', sandbox: 'sandbox-7', config: rebase, solution: rebaseSolution },
];
