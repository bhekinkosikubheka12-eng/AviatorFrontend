import { Component, ChangeDetectionStrategy } from '@angular/core';
import { AviatorGameComponent } from './components/aviator-game/aviator-game.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [AviatorGameComponent],
  template: `<app-aviator-game></app-aviator-game>`,
  styles: [`
    :host {
      display: block;
      width: 100vw;
      height: 100vh;
      overflow: hidden;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent {}
