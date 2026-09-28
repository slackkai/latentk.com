import { config as where, solution as whereSolution } from './01-where.js';
import { config as make, solution as makeSolution } from './02-make.js';
import { config as look, solution as lookSolution } from './03-look.js';
import { config as find, solution as findSolution } from './04-find.js';
import { config as chmod, solution as chmodSolution } from './05-chmod.js';
import { config as pipe, solution as pipeSolution } from './06-pipe.js';
import { config as rescue, solution as rescueSolution } from './07-rescue.js';

export const lessons = [
  { id: '01-where', config: where, solution: whereSolution },
  { id: '02-make', config: make, solution: makeSolution },
  { id: '03-look', config: look, solution: lookSolution },
  { id: '04-find', config: find, solution: findSolution },
  { id: '05-chmod', config: chmod, solution: chmodSolution },
  { id: '06-pipe', config: pipe, solution: pipeSolution },
  { id: '07-rescue', config: rescue, solution: rescueSolution },
];