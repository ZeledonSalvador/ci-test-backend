import * as moment from 'moment-timezone';
import { Injectable } from '@nestjs/common';

@Injectable()
export class TimeService {
  private readonly timeZone: string;

  constructor() {
    this.timeZone = process.env.TIMEZONE || 'America/El_Salvador';
  }

  getCurrentDate(): Date {
    return moment().tz(this.timeZone).toDate();
  }

  getCurrentDateAsString(): string {
    const time = moment().tz(this.timeZone).format('YYYY-MM-DDTHH:mm:ss');
    console.log('El time es: ', time);
    return time;
  }
}
