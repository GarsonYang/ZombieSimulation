import { City } from './city';
import { Point } from './util';

//config
const SCALE = 4; //pixels per block
const SPEED = 100; //turns per second

//this is the controller!
class ZombieSim {
  private canvasContext: CanvasRenderingContext2D;
  private timerId: number = -1;
  private size: { width: number, height: number };
  private city!: City;
  private mapChoice: string = '1';

  constructor(private canvas: HTMLCanvasElement) {
    //connect it to the html   
    this.canvasContext = canvas.getContext('2d') as CanvasRenderingContext2D;
    this.canvasContext.scale(SCALE, SCALE); //scaling done through context
    this.size = { width: Math.floor(canvas.width / SCALE), height: Math.floor(canvas.height / SCALE) };

    this.reset();
  }

  setMapChoice(choice: string) {
    this.mapChoice = choice;
  }

  reset() {
    //initialize
    //this.city = new City(this.size.width, this.size.height, this.mapChoice);
    this.city = new City(new Point(0,0), new Point(this.size.width-1, this.size.height-1), this.mapChoice);
    this.city.render(this.canvasContext);
  }

  step() {
    this.city.moveAgents(null);
    this.city.render(this.canvasContext);
  }

  start() {
    window.clearInterval(this.timerId);
    this.timerId = window.setInterval(() => this.step(), 1000 / SPEED);
  }

  pause() {
    window.clearInterval(this.timerId);
  }
}

//instantiate the sim / connect to HTML
const canvas = $('#canvas')[0] as HTMLCanvasElement;
const sim: ZombieSim = new ZombieSim(canvas);

//connect the control buttons
const startButton = $('#startButton').click(() => sim.start());
const pauseButton = $('#pauseButton').click(() => sim.pause());
const resetButton = $('#resetButton').click(() => sim.reset());
const stepButton = $('#stepButton').click(() => sim.step());
const mapSelect = $('#mapSelect').change((e) => {
  let val = $(e.target).val();
  sim.setMapChoice(val as string);
  sim.reset();
});

//debugging coordinates
$('#canvas').click((e) => console.log(Math.floor(e.offsetX as number / SCALE), Math.floor(e.offsetY as number / SCALE)));
