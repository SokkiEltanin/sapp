import { ImageSourcePropType } from 'react-native';
import { Sun, CloudSun, Cloud, CloudFog, CloudDrizzle, CloudRain, CloudSnow, CloudLightning } from 'lucide-react-native';

// Minimalist lucide weather icon + a tint, mapped from a WMO code. Replaces the
// cartoon PNG artwork ("emotki") with clean line icons.
export function weatherLucide(code: number): { Icon: any; color: string } {
  if (code < 0)   return { Icon: Cloud,          color: '#9CA3AF' };
  if (code === 0) return { Icon: Sun,            color: '#FBBF24' };
  if (code <= 2)  return { Icon: CloudSun,       color: '#FCD34D' };
  if (code <= 48) return { Icon: code >= 45 ? CloudFog : Cloud, color: '#B7C0CC' };
  if (code <= 57) return { Icon: CloudDrizzle,   color: '#7FB2F0' };
  if (code <= 67) return { Icon: CloudRain,      color: '#5B9BE0' };
  if (code <= 77) return { Icon: CloudSnow,      color: '#CFE3F5' };
  if (code <= 82) return { Icon: CloudRain,      color: '#5B9BE0' };
  if (code <= 86) return { Icon: CloudSnow,      color: '#CFE3F5' };
  return { Icon: CloudLightning, color: '#A78BFA' };
}

// Custom weather artwork (assets/weather) mapped from WMO weather codes.
const ICONS = {
  clear:    require('../../assets/weather/sunsets.png'),   // 0 — clear sun
  fewCloud: require('../../assets/weather/cloud.png'),     // 1–2 — sun + a cloud
  cloudy:   require('../../assets/weather/cloudy.png'),    // 3, fog — overcast
  rain:     require('../../assets/weather/rain.png'),      // drizzle / rain / showers
  snow:     require('../../assets/weather/snow.png'),      // snow
  storm:    require('../../assets/weather/storm.png'),     // thunderstorm
};

export function weatherIconPng(code: number): ImageSourcePropType {
  if (code < 0) return ICONS.cloudy;
  if (code === 0) return ICONS.clear;
  if (code <= 2) return ICONS.fewCloud;
  if (code <= 48) return ICONS.cloudy;   // 3 overcast + 45/48 fog
  if (code <= 67) return ICONS.rain;     // drizzle + rain
  if (code <= 77) return ICONS.snow;     // snow
  if (code <= 82) return ICONS.rain;     // rain showers
  if (code <= 86) return ICONS.snow;     // snow showers
  return ICONS.storm;                    // 95–99 thunderstorm
}
