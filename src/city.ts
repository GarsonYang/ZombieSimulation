import { Point, Facing } from './util';
import { Agent, AgentFactory } from './agents';

import * as lodash from 'lodash';
let _: any = lodash; //alias that can be modified (for seeding random numbers)

//this seeds Math.random(), so use original lodash context for non-deterministic random
//import * as seedrandom from 'seedrandom'; //seeded random numbers
import seedrandom = require('seedrandom');

type ColorDict = { [key: string]: string }

const Colors: ColorDict = {
  //from mapbox.streets-basic
  'building': '#d9ccbf',
  'city': '#ede5c9',
  'room': '#dee0c1',
  'wall': "#c8c2ac"
}

//city creation parameters; can adjust here
const Config = {
  populationPercentage: .05, //5% density works nicely
  blockSize: { min: 15, max: 40 },
  buildingSize: { min: 10, max: 25 },
  roomSize: { min: 3, max: 5 },
  numberExits: { min: 2, max: 10 }
}

abstract class Component {
  protected componentName: string = '';
  protected population: Agent[] = [];
  protected subcomponents: Component[] = [];
  protected exits: Array<Point> = [];

  protected width: number;
  protected height: number;

  constructor(readonly min: Point, readonly max: Point,
    protected lightCondition: ILightStrategy = new NormalLight()) {
    this.width = this.max.x - this.min.x;
    this.height = this.max.y - this.min.y;
  }

  protected defineExits() {
    let perimeter = (this.width) * 2 + (this.height) * 2;
    let numExits = _.random(Config.numberExits.min, Config.numberExits.max);
    let spots = _.sampleSize(_.range(1, perimeter - 3), numExits);
    this.exits = spots.map((spot: number) => {
      if (spot < this.width) return new Point(this.min.x + spot, this.min.y); //top wall
      spot -= this.width;
      spot++; //move around corner
      if (spot < this.height) return new Point(this.max.x, this.min.y + spot); //left wall
      spot -= this.height;
      spot++;
      if (spot < this.width) return new Point(this.max.x - spot, this.max.y); //bottom wall
      spot -= this.width;
      spot++;
      return new Point(this.min.x, this.max.y - spot); //right wall
    })
  }

  //walls are considered to be "in" the building
  public contains(location: Point): boolean {
    return location.x >= this.min.x && location.x <= this.max.x && location.y >= this.min.y && location.y <= this.max.y;
  }

  public subcomponentAt(location: Point): Component | null {
    //linear search; could replace with a stored Map for faster access
    for (let subcomponent of this.subcomponents) {
      if (subcomponent.contains(location)) return subcomponent;
    }
    return null;
  }

  //includes doors (basically: on border)
  public hasWallAt(location: Point): boolean {
    // console.log('loc:', location, 'min:',this.min, 'max:',this.max);
    let potentialWall = (location.x === this.min.x || location.x === this.max.x || location.y === this.min.y || location.y === this.max.y);
    return potentialWall && this.contains(location);
  }

  protected lookAround() {
    let visionDistance = this.lightCondition.getVisionDistance();
    //look around
    for (let i = 0; i < this.population.length; i++) {
      let agent = this.population[i];
      let seenAgent = this.lookAhead(agent.location, agent.facing, visionDistance);
      this.population[i] = agent.see(seenAgent);
    }
  }

  public moveAgents(supercomponent: Component | null) {
    this.lookAround();

    //Use a "filter" to remove agents who have left
    //The filter() callback has a side effect of moving agents
    this.population = this.population.filter((agent) => {
      let nextSpot = new Point(agent.location.x + agent.facing.x, agent.location.y + agent.facing.y);
      let subcomponent = this.subcomponentAt(nextSpot);

      //if next spot is in supercomponent, check supercomponent
      if (supercomponent && !this.contains(nextSpot)) {
        return !this.getEntrance(nextSpot, supercomponent, agent);
      }
      //if next spot is in subcomponent, check subcomponent
      else if (subcomponent) {
        return !this.getEntrance(nextSpot, subcomponent, agent);
      }
      //move agents in the current component
      else {
        agent.move(!this.isBlocked(nextSpot));
        return true; //keep the agent    
      }
    })

    this.agentsInteract();

    for (let subcomponent of this.subcomponents) {
      subcomponent.moveAgents(this);
    }
  }

  private isBlocked(nextSpot: Point): boolean {
    //check walls
    if (this.hasWallAt(nextSpot) && !this.hasExitAt(nextSpot)) {
      return true;
    }
    //check agent at the next spot
    else {
      if (this.agentAt(nextSpot) !== null) {
        return true;
      } else return false;
    }
  }

  private getEntrance(nextSpot: Point, otherComponent: Component, agent: Agent): boolean {
    if (otherComponent.isBlocked(nextSpot)) {
      agent.move(false); //blocked 
      return false;
    } else {
      otherComponent.addAgent(agent, nextSpot); //able to move to other component
      return true;
    }
  }

  public agentAt(location: Point): Agent | null {
    for (let agent of this.population) {
      if (agent.location.x == location.x && agent.location.y == location.y)
        return agent;
    }
    return null;
  }

  public agentsInteract() {
    //interact with people next to each agent
    for (let agent of this.population) {
      let nextSpot = new Point(agent.location.x + agent.facing.x, agent.location.y + agent.facing.y);
      let target = this.agentAt(nextSpot);
      if (target) {
        let idx = this.population.indexOf(target);
        this.population[idx] = agent.interactWith(target);
      }
    }
  }

  public addAgent(agent: Agent, loc: Point) {
    let subcomponent = this.subcomponentAt(loc);
    if (subcomponent) {
      subcomponent.addAgent(agent, loc);
    }
    else this.population.unshift(agent); //add to front so act first when arriving
  }


  protected lookAhead(start: Point, direction: Point, maxDistance = 10): Agent | null {
    //linear search for closest agent
    let closest = null;
    let closestDist = maxDistance + 1;
    for (let agent of this.population) {
      let loc = agent.location;
      let dx = (loc.x - start.x) * direction.x; //distance scaled by facing
      let dy = (loc.y - start.y) * direction.y; //distance scaled by facing
      if ((start.x == loc.x && (dy > 0 && dy < closestDist)) || (start.y == loc.y && (dx > 0 && dx < closestDist))) { //can see agent
        closestDist = Math.max(dx, dy);
        closest = agent;
      }
    }

    //check for intervening walls
    if (closest && this.subcomponents.length !== 0) {
      for (let i = 1; i < closestDist; i++) {
        let nextSpot = new Point(start.x + direction.x * i, start.y + direction.y * i)
        if (this.hasWallAt(nextSpot)) {
          return null; //blocked by component's own wall
        }
        for (let subcomponent of this.subcomponents) {
          if (subcomponent.hasWallAt(nextSpot))
            return null; //blocked by subcomponent's wall
        }
      }
    }

    return closest;
  }

  public hasExitAt(location: Point): boolean {
    for (let exit of this.exits) {
      if (exit.x === location.x && exit.y === location.y)
        return true;
    }
    return false;
  }

  public render(context: CanvasRenderingContext2D) {
    //render self
    context.fillStyle = Colors['wall']; //outside wall
    context.fillRect(this.min.x, this.min.y, this.max.x - this.min.x + 1, this.max.y - this.min.y + 1);


    context.fillStyle = Colors[this.componentName]; //inside floor
    context.fillRect(this.min.x + 1, this.min.y + 1, this.max.x - this.min.x - 1, this.max.y - this.min.y - 1);

    context.fillStyle = 'black'; //mimic lighting condition
    context.globalAlpha = this.lightCondition.getOpacity() //dimmer light, lower opacity
    context.fillRect(this.min.x + 1, this.min.y + 1, this.max.x - this.min.x - 1, this.max.y - this.min.y - 1);
    context.globalAlpha = 1.0 //set opacity back to default

    context.fillStyle = Colors[this.componentName]; //exits (rendered individually)
    for (let exit of this.exits) {
      context.fillRect(exit.x, exit.y, 1, 1);//Building.WALL_WIDTH, Building.WALL_WIDTH);
    }

    //render agents
    for (let agent of this.population) {
      agent.render(context);
    }

    //render subcomponents
    for (let subcomponent of this.subcomponents) {
      subcomponent.render(context);
    }
  }
}

//city holds street and buildings
export class City extends Component {
  readonly componentName: string = 'city';

  constructor(readonly min: Point, readonly max: Point, private mapSeed: string | null) {
    super(min, max);

    if (mapSeed) {
      seedrandom(mapSeed, { global: true }); //seed the random value
      _ = lodash.runInContext(); //load with global seed
    } else {
      _ = lodash; //load original (unseeded) globals
    }

    //size accounts for border road
    this.subcomponents = this.makeSubdivision(new Point(1, 1), new Point(this.width - 1, this.height - 1));

    this.populate();
  }

  //recursively divides the area into a block
  private makeSubdivision(min: Point, max: Point, iter = -1): Component[] {
    if (iter === 0) { return []; } //if counted down

    const width = max.x - min.x;
    const height = max.y - min.y;

    const atWidth = width < Config.blockSize.max;
    const atHeight = height < Config.blockSize.max;
    if (atWidth && atHeight) {
      if (width > Config.buildingSize.min && height > Config.buildingSize.min) {
        let subcomponent;
        if (_.random(1.0, true) < .3) { //30% chance buildings are out of electricity
          subcomponent = new Building(
            new Point(min.x + _.random(1, 2), min.y + _.random(1, 2)), //min corner
            new Point(max.x - _.random(1, 2), max.y - _.random(1, 2)),
            new DarkLight()); //max corner
        } else {
          subcomponent = new Building(
            new Point(min.x + _.random(1, 2), min.y + _.random(1, 2)), //min corner
            new Point(max.x - _.random(1, 2), max.y - _.random(1, 2))); //max corner
        }
        return [subcomponent];  //list of created (single) building
      } else {
        return []; //list of no buildings
      }
    }

    let divideOnX = _.random(0, 1) === 1;
    if (atHeight) divideOnX = true;
    if (atWidth) divideOnX = false;

    let sub1, sub2;
    if (divideOnX) {
      const div = _.random(min.x, max.x);
      sub1 = this.makeSubdivision(new Point(min.x, min.y), new Point(div, max.y), --iter);
      sub2 = this.makeSubdivision(new Point(div, min.y), new Point(max.x, max.y), --iter);
    } else {
      const div = _.random(min.y, max.y);
      sub1 = this.makeSubdivision(new Point(min.x, min.y), new Point(max.x, div), --iter);
      sub2 = this.makeSubdivision(new Point(min.x, div), new Point(max.x, max.y), --iter);
    }
    return _.concat(sub1, sub2);
  }

  private populate(): void {
    let possiblePlaces: { loc: Point, subcomponent: Component | null }[] = [];
    let walls = 0;
    for (let i = 1; i < this.width; i++) {
      for (let j = 1; j < this.height; j++) {
        const loc = new Point(i, j);
        let subcomponent = this.subcomponentAt(loc);
        if (subcomponent == null || !subcomponent.hasWallAt(loc)) {
          possiblePlaces.push({ loc: loc, subcomponent: subcomponent });
        }
      }
    }

    //sample and place people
    let numHumans = Math.floor(this.width * this.height * Config.populationPercentage);

    let factory = new AgentFactory();

    _.sampleSize(possiblePlaces, numHumans + 1).forEach((placeObj: { loc: Point, subcomponent: Component | null }, idx: number) => {
      let newAgent;
      if (idx < numHumans)
        newAgent = factory.createAgent('normal human', placeObj.loc);
      else {//last person is a zombie!
        newAgent = factory.createAgent('zombie', placeObj.loc);
      }

      if (placeObj.subcomponent) {
        placeObj.subcomponent.addAgent(newAgent, placeObj.loc);
      }
      else {
        this.addAgent(newAgent, placeObj.loc);
      }
    })
  }
}

export class Building extends Component {
  readonly componentName: string = 'building';

  constructor(readonly min: Point, readonly max: Point, protected lightCondition: ILightStrategy = new NormalLight()) {
    super(min, max);
    this.defineExits()

    this.subcomponents = this.makeSubdivision(new Point(min.x + 1, min.y + 1), new Point(this.width - 1, this.height - 1));
  }

  private makeSubdivision(min: Point, max: Point, iter = -1): Component[] {
    if (iter === 0) { return []; } //if counted down

    const width = max.x - min.x;
    const height = max.y - min.y;

    const atWidth = width < Config.blockSize.max;
    const atHeight = height < Config.blockSize.max;
    if (atWidth && atHeight) {
      if (width > Config.roomSize.min && height > Config.roomSize.min) {
        let subcomponent;
        if (_.random(1.0, true) < .3) {
          subcomponent = new Room(
            new Point(min.x + _.random(1, 2), min.y + _.random(1, 2)), //min corner
            new Point(max.x - _.random(1, 2), max.y - _.random(1, 2)), //max corner
            new DarkLight());
        } else {
          subcomponent = new Room(
            new Point(min.x + _.random(1, 2), min.y + _.random(1, 2)), //min corner
            new Point(max.x - _.random(1, 2), max.y - _.random(1, 2))); //max corner
        }
        return [subcomponent];  //list of created (single) building
      } else {
        return []; //list of no buildings
      }
    }

    let divideOnX = _.random(0, 1) === 1;
    if (atHeight) divideOnX = true;
    if (atWidth) divideOnX = false;

    let sub1, sub2;
    if (divideOnX) {
      const div = _.random(min.x, max.x);
      sub1 = this.makeSubdivision(new Point(min.x, min.y), new Point(div, max.y), --iter);
      sub2 = this.makeSubdivision(new Point(div, min.y), new Point(max.x, max.y), --iter);
    } else {
      const div = _.random(min.y, max.y);
      sub1 = this.makeSubdivision(new Point(min.x, min.y), new Point(max.x, div), --iter);
      sub2 = this.makeSubdivision(new Point(min.x, div), new Point(max.x, max.y), --iter);
    }
    return _.concat(sub1, sub2);
  }
}

export class Room extends Component {
  readonly componentName: string = 'room';

  constructor(readonly min: Point, readonly max: Point, protected lightCondition: ILightStrategy = new NormalLight()) {
    super(min, max);
    this.defineExits()
  }
}

interface ILightStrategy {
  getVisionDistance(): number;
  getOpacity(): number;
}

class NormalLight implements ILightStrategy {
  private distance: number = 10;
  private opacity = 0;
  getVisionDistance(): number {
    return this.distance;
  }
  getOpacity(): number {
    return this.opacity;
  }
}

class DarkLight implements ILightStrategy {
  private distance: number = 1;
  private opacity = 0.3;
  getVisionDistance(): number {
    return this.distance;
  }
  getOpacity(): number {
    return this.opacity;
  }
}