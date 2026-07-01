import { ImageSourcePropType } from 'react-native';

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
