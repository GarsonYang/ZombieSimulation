import { Point, Facing } from './util';

import * as lodash from 'lodash';
let _: any = lodash;

/** un-comment below to enable deterministic random for testing **/
/** you need to refresh the page to use the same seed **/
// import seedrandom = require('seedrandom'); //seeded random numbers
// seedrandom('1', {global:true}); //seed the random value
// _ = lodash.runInContext(); //load with global seed    

export class Agent {
  private state: IHumanState;
  protected speed: number = 0;
  constructor(public location: Point, public facing: Point = Facing.South) {
    this.state = new NormalHuman(this);
  }

  isNormal() {
    if (this.state instanceof NormalHuman) return true;
    else return false;
  }

  isPanicked() {
    if (this.state instanceof PanickedHuman) return true;
    else return false;
  }

  isSick() {
    if (this.state instanceof SickHuman) return true;
    else return false;
  }

  isZombie() {
    if (this.state instanceof Zombie) return true;
    else return false;
  }

  turnOpposite() {
    this.facing = new Point(-1 * this.facing.x, -1 * this.facing.y);
  }

  setState(newState: IHumanState) {
    this.state = newState;
  }

  //Reacts to other agent (or lackthereof) it sees
  //Returns the updated self (for convenience/transforming)
  see(target: Agent | null): Agent {
    return this.state.see(target);
  };

  move(pathClear: boolean = false) {
    this.state.move(pathClear);
  }

  //Interacts with (modifies) other agent
  //Returns the modified other (for convenience/transforming)
  interactWith(target: Agent): Agent {
    return this.state.interactWith(target);
  }

  render(context: CanvasRenderingContext2D) {
    this.state.render(context);
  }
}

interface IHumanState {
  getAgent(): Agent;
  move(facingBlocked: boolean): Point;
  see(target: Agent | null): Agent;
  interactWith(target: Agent): Agent;
  render(context: CanvasRenderingContext2D): void;
}

class NormalHuman implements IHumanState {
  protected speed: number = .5; //chance to move (percentage)

  constructor(private agent: Agent) { }

  getAgent() {
    return this.agent;
  }

  move(pathClear: boolean = true) {
    if (_.random(true) > this.speed) return this.agent.location; //don't move

    if (pathClear) {
      this.agent.location.x += this.agent.facing.x;
      this.agent.location.y += this.agent.facing.y;
    }
    else {
      this.agent.facing = Facing.Directions[_.random(0, Facing.Directions.length - 1)];
    }

    return this.agent.location;
  }
  //runs away from zombies
  see(target: Agent | null): Agent {
    if (target) {
      if (target.isZombie()) {
        //panic and turn around
        this.agent.turnOpposite();
        this.agent.setState(new PanickedHuman(this.agent));
        return this.agent;
      }
      else if (target.isSick() || target.isPanicked()) {
        //panic without turning
        this.agent.setState(new PanickedHuman(this.agent));
        return this.agent;
      }
      else if (_.random(1.0, true) < 0.15) //chance to turn anyway
        this.agent.facing = Facing.Directions[_.random(0, Facing.Directions.length - 1)];
    }
    return this.agent;
  }

  interactWith(target: Agent): Agent {
    return target; //no modification (default)
  }

  render(context: CanvasRenderingContext2D) {
    context.fillStyle = "#F9A7B0" //color
    context.fillRect(this.agent.location.x, this.agent.location.y, 1, 1);
  }
}

class PanickedHuman implements IHumanState {
  private fearLevel: number = 10;
  protected speed: number = 1.0;
  constructor(private agent: Agent) { }

  getAgent() {
    return this.agent;
  }

  move(pathClear: boolean = true) {
    if (_.random(true) > this.speed) return this.agent.location; //don't move

    if (pathClear) {
      this.agent.location.x += this.agent.facing.x;
      this.agent.location.y += this.agent.facing.y;
    }
    else {
      this.agent.facing = Facing.Directions[_.random(0, Facing.Directions.length - 1)];
    }
    return this.agent.location;
  }

  see(target: Agent | null): Agent {
    if (this.fearLevel > 0) {
      this.fearLevel--;
    }

    if (target && target.isZombie()) {
      this.fearLevel = 10;
    }

    if (this.fearLevel == 0) {
      this.agent.setState(new NormalHuman(this.agent));
      return this.agent;
    }

    return this.agent;
  }

  interactWith(target: Agent): Agent {
    return target; //no modification (default)
  }

  render(context: CanvasRenderingContext2D) {
    context.fillStyle = "#FFF380" //color
    context.fillRect(this.agent.location.x, this.agent.location.y, 1, 1);
  }
}

class SickHuman implements IHumanState {
  private sickLevel: number = 1;
  protected speed: number = 0.4;
  constructor(private agent: Agent) { }

  getAgent() {
    return this.agent;
  }

  move(pathClear: boolean = true) {
    if (_.random(true) > this.speed) return this.agent.location; //don't move

    if (pathClear) {
      this.agent.location.x += this.agent.facing.x;
      this.agent.location.y += this.agent.facing.y;
    }
    else {
      this.agent.facing = Facing.Directions[_.random(0, Facing.Directions.length - 1)];
    }
    return this.agent.location;
  }

  see(target: Agent | null): Agent {
    if (this.sickLevel == 25) { //sick human become zombie after 25 steps
      this.agent.setState(new Zombie(this.agent));
      return this.agent;
    } else if (_.random(1.0, true) < 0.15) {// 15% chance to turn 
      this.agent.facing = Facing.Directions[_.random(0, Facing.Directions.length - 1)];
    }
    this.sickLevel++;
    return this.agent;
  }

  interactWith(target: Agent): Agent {
    return target; //no modification (default)
  }

  render(context: CanvasRenderingContext2D) {
    context.fillStyle = "#FC2AEE" //color
    context.fillRect(this.agent.location.x, this.agent.location.y, 1, 1);
  }
}

class Zombie implements IHumanState {
  private timePursuing = 0;
  private speed: number = .3; //chance to move

  constructor(private agent: Agent) { }

  getAgent() {
    return this.agent;
  }

  move(pathClear: boolean = true) {
    if (_.random(true) > this.speed) return this.agent.location; //don't move

    if (pathClear) {
      this.agent.location.x += this.agent.facing.x;
      this.agent.location.y += this.agent.facing.y;
    }
    else {
      this.agent.facing = Facing.Directions[_.random(0, Facing.Directions.length - 1)];
    }

    return this.agent.location;
  }

  see(target: Agent | null): Agent {
    if (this.timePursuing > 0)
      this.timePursuing--;

    if (target && (target.isNormal() || target.isPanicked())) {
      this.timePursuing = 10; //start chasing
    }
    else if (this.timePursuing === 0 && !target) { //if don't see anything, wander
      this.agent.facing = Facing.Directions[_.random(0, Facing.Directions.length - 1)];
    }
    return this.agent;
  }

  //bites humans!
  interactWith(target: Agent): Agent {
    if (target.isNormal() || target.isPanicked()) {
      target.setState(new SickHuman(target));
      return target;
    }
    return target;
  }

  render(context: CanvasRenderingContext2D) {
    context.fillStyle = "#0f0" //color
    context.fillRect(this.agent.location.x, this.agent.location.y, 1, 1);
  }
}

export interface IFactory {
  createAgent(agentType: string, loc: Point): Agent;
}

export class AgentFactory implements IFactory {
  createAgent(agentType: string, loc: Point): Agent {
    let newAgent = new Agent(loc);
    if (agentType === 'zombie') {
      newAgent.setState(new Zombie(newAgent));
    }
    return newAgent;
  }
}

