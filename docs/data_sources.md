# Resources used in MissionForge

Everything we used, including open-source and freely available material. 

## 1. Data
| Name | URL | Provider | Variables | Date accessed | Used for | Limitations |
|---|---|---|---|---|---|---|
| NASA PCoE Battery Data Set (B. Saha and K. Goebel, 2007) | https://www.nasa.gov/content/prognostics-center-of-excellence-data-set-repository | NASA Ames Prognostics Center of Excellence | discharge capacity vs cycle | 13 Nov 2026 | spread of battery fade in the Reality Check | lab cells, not flight batteries; analogue only. Linear fit of discharge capacity per cycle for B0005, B0006, B0007 and B0018; only the spread between cells (cv 0.149) is used, not the absolute fade |
| LRO instrument mass and average power | https://webarchive.library.unt.edu/web/20090922191046/http:/lro.gsfc.nasa.gov/images/LRO_LCROSS_presskit.pdf | NASA, LRO/LCROSS Press Kit, June 2009 | instrument mass (kg) and average power (W) | 14 Nov 2026 | component catalogue | launch-time design figures from 2009; in-flight values may differ; data rates not included |
| Lunar constants (GM, radius, solar irradiance) | https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html | NASA NSSDCA Moon Fact Sheet | gravitational parameter, mean radius, solar irradiance | 14 Nov 2026 | orbit and power calculations | rounded to 3 significant figures |
| Orbit periods and eclipse tables | scripts/derive_orbits.mjs and js/sim/orbital.js in our repo | Calculated by the team from the constants above | period, eclipse share vs sun angle | 14 Nov 2026 | orbit options | two-body model; contact time and insertion delta-v are Illustrative |


## 2. Space Apps challenge and partner agency resources
Resources from the challenge page that shaped the design:
- Design and Develop Science Missions (four mission segments)
- Concept Maturity Levels and Mission Design Lab
- General Mission Analysis Tool, GMAT
- A Learning Game About Telescopes
- CubeSat 101
- NASA Mission Viz

## 4. Tools
- GitHub, Visual Studio Code

## 6. Copyright check
We checked terms of use for each item above.