




export class Timer {
    private timeout: any;
    private pings: number = 0;
    private numberOfSeconds: number = 60;
    private shutdownFunction: (code: number) => void;

    setShutdown(shutdownFunction: (number) => void) {
        this.shutdownFunction = shutdownFunction;
    }

    startTimer(numberOfSeconds) {
        this.pings = 0;
        this.numberOfSeconds = numberOfSeconds;
        this.timeout = setTimeout(() => {
            this.timerCheck();
        }, 1000 *  numberOfSeconds);
    }

    ping() {
        this.pings++;
    }

    stop() {
        clearTimeout(this.timeout);
    }

    private timerCheck() {
        this.pings--;
        if (this.pings <= 0) {
            if (this.shutdownFunction !== undefined) {
                this.shutdownFunction(0)
            }
        } else {
            this.startTimer(this.numberOfSeconds);
        }
    }

}