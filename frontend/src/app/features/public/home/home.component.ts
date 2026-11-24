import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { environment } from '../../../../environments/environment';
import { BrandMarkComponent } from '../../../shared/components/brand-mark.component';
import { PublicFooterComponent, PublicHeaderComponent } from '../../../shared/components/public-chrome.component';
import { icons } from '../../../shared/icons';

@Component({
  selector: 'app-home',
  imports: [RouterLink, FaIconComponent, BrandMarkComponent, PublicHeaderComponent, PublicFooterComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent {
  protected readonly icons = icons;
  protected readonly shopSlug = environment.demoShopSlug;
}
