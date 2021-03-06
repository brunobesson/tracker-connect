import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

export interface Status {
  startTime: string;
  upTime: string;
  isShuttingDown: boolean;
}

export class HealthService {
  private startTime: number;
  private isShuttingDown = false;

  constructor() {
    this.startTime = Date.now();
  }

  public setShuttingDown(): void {
    this.isShuttingDown = true;
  }

  public getStatus(): Status {
    return {
      startTime: new Date(this.startTime).toISOString(),
      upTime: dayjs(this.startTime).fromNow(true),
      isShuttingDown: this.isShuttingDown,
    };
  }
}

export const healthService = new HealthService();
