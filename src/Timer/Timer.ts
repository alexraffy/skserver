




export class Timer {
    private static _instance: Timer;

    private pings: number = 0;
    private numberOfSeconds: number = 60;
    private shutdownFunction: (code: number) => void;
    constructor() {
        Timer._instance = this;
    }


    static get instance(): Timer {
        if (Timer._instance === undefined) {
            return new Timer();
        }
        return Timer._instance;
    }

    setShutdown(shutdownFunction: (number) => void) {
        this.shutdownFunction = shutdownFunction;
    }


    startTimer(numberOfSeconds) {
        this.pings = 0;
        this.numberOfSeconds = numberOfSeconds;
        setTimeout(() => {
            this.timerCheck();
        }, 1000 *  numberOfSeconds);
    }

    ping() {
        this.pings++;
    }

    private timerCheck() {
        if (this.pings === 0) {
            if (this.shutdownFunction !== undefined) {
                this.shutdownFunction(0)
            }
        } else {
            this.startTimer(this.numberOfSeconds);
        }
    }

}