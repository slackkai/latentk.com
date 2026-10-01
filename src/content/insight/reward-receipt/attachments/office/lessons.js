import { makeWorld, bestTrip, receipt, HORIZON } from './model.js';
export const lessons = {
  1: { title:'第一单 · 早到晚到一个价', intro:'送到 +10，其他不计。它会立刻出发吗？', prices:{deliver:10}, knobs:[['step','每一步的耗电成本',0,1,.05]], hint:'让等待也付一点代价。不需要很贵，每步 0.1 就能打破平局。', fix:{step:-.1}, goal:'让它在 13 步内送到。' },
  2: { title:'第二单 · 罚得越狠，越想收工', intro:'现在每一步扣 2 分。楼梯只要 3 步，桌子却要 13 步。', prices:{deliver:10,step:-2}, knobs:[['step','每一步的耗电成本',0,3,.1],['fall','掉下楼梯的损失',0,40,1]], hint:'楼梯也是结束，不再扣后面的电费。把坠落本身计入小票，或者降低每步成本。', fix:{fall:-20}, goal:'送到桌子，不从楼梯提前收工。' },
  3: { title:'第三单 · 来回踱步也能挣钱', intro:'每靠近一步 +1，但退回去没有这一行。先看小票上的「靠近」次数。', prices:{deliver:10,step:-.1,fall:-30,closer:1}, knobs:[['away','每远离一步扣回多少',0,1.5,.1]], hint:'靠近给 1，远离收回 1。一次来回的两笔账相抵，就不能凭原地往返挣钱。', fix:{away:-1}, goal:'不靠往返刷分，13 步送到。' },
  4: { title:'第四单 · 小票上没写的损失', intro:'最短路线经过花瓶，绕一步又可能踩到猫。地图一直把它们画在这里，价目表却未必记得。', prices:{deliver:10,step:-.1,fall:-30}, knobs:[['vase','打碎一次花瓶的损失',0,5,.1],['cat','踩到一次猫的损失',0,5,.1]], hint:'先只给花瓶标价，看路线改到哪里；再考虑猫。两项都设为 1，已经足够让它绕开。', fix:{vase:-1,cat:-1}, goal:'送到，而且花瓶与猫都安好。' },
};
export function setup(level) {
  const world=makeWorld(level===4?{vase:true,cat:true}:{});
  const reference=bestTrip(world,{deliver:10,step:-.1,fall:-100,vase:-100,cat:-100});
  return {world,reference,config:lessons[level]};
}
export function passed(level,trip) {
  return trip.end==='deliver' && (level===4 ? trip.flags===0 : level===2 || trip.length===13);
}
export function evaluate(level, prices) {
  const {world,reference}=setup(level),trip=bestTrip(world,prices,HORIZON);
  return {trip,actual:receipt(trip,prices),expected:receipt(reference,prices),pass:passed(level,trip)};
}
