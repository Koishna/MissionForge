# Resources used in MissionForge

Everything we used, including open-source and freely available material. 

## 1. Data

Badges: PUBLISHED = copied from a cited source. CALCULATED = computed by our code from published constants. ILLUSTRATIVE = team assumption, not a measurement.

### 1.1 Published and calculated sources
| Name | URL | Provider | Variables | Date accessed | Used for | Limitations |
|---|---|---|---|---|---|---|
| NASA PCoE Battery Data Set (B. Saha and K. Goebel, 2007) | https://www.nasa.gov/content/prognostics-center-of-excellence-data-set-repository | NASA Ames Prognostics Center of Excellence | discharge capacity vs cycle | 13 Nov 2026 | spread of battery fade in the Reality Check | lab cells, not flight batteries; analogue only. Linear fit of discharge capacity per cycle for B0005, B0006, B0007 and B0018; only the spread between cells (cv 0.149) is used, not the absolute fade |
| LRO instrument mass and average power | https://webarchive.library.unt.edu/web/20090922191046/http:/lro.gsfc.nasa.gov/images/LRO_LCROSS_presskit.pdf | NASA, LRO/LCROSS Press Kit, June 2009 | instrument mass (kg) and average power (W) | 14 Nov 2026 | component catalogue | launch-time design figures from 2009; in-flight values may differ; data rates not included |
| Lunar constants (GM, radius, solar irradiance) | https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html | NASA NSSDCA Moon Fact Sheet (page last updated 11 Jan 2024) | gravitational parameter 4.9e12 m^3/s^2, mean radius 1737.4 km, solar irradiance 1361.0 W/m^2 | 14 Nov 2026 | `constants.json`; orbit and power calculations | rounded to 3 significant figures; re-check values on the live page |
| Orbit periods and eclipse tables | scripts/derive_orbits.mjs and js/sim/orbital.js in our repo | Calculated by the team from the constants above | `period_s`, `eclipse_fraction`, `eclipse_by_beta` (3 orbits) | 14 Nov 2026 | orbit options | two-body model; contact time and insertion delta-v are Illustrative. Cylindrical Moon shadow, polar orbit fixed in space, worst-case orientation (conservative). Not yet cross-checked with GMAT |
| LRO mission record | https://webarchive.library.unt.edu/web/20130222001006/http://nssdc.gsfc.nasa.gov/database/MasterCatalog?sc=LUNARRO | NASA NSSDCA (archived) | one-year mission; 30-70 km polar orbit; extended 30 x 216 km orbit | 14 Nov 2026 | `elliptical-frozen` altitudes (30 and 216 km); LRO entry in `missions.json` | Archived pre-launch page |
| LRO SPICE catalog | https://naif.jpl.nasa.gov/pub/naif/pds/data/lro-l-spice-6-v1.0/lrosp_1000/catalog/insthost.cat | NASA JPL NAIF | base mission 50 +/- 20 km; 30 x 216 km low-maintenance orbit | 14 Nov 2026 | LRO orbit in `missions.json` | Text description only |
| LRO/LCROSS Press Kit, June 2009 (spacecraft masses) | https://webarchive.library.unt.edu/web/20090922191046/http:/lro.gsfc.nasa.gov/images/LRO_LCROSS_presskit.pdf | NASA (Goddard / Ames), archived by UNT | launch mass 1,916 kg, dry mass 1,018 kg, fuel 898 kg; instrument list | 14 Nov 2026 | LRO masses in `missions.json` | Figures confirmed by the team against the PDF on 14 Nov 2026. Pre-launch NASA documents give 1,846 kg launch mass |
| Lunar Prospector page | https://nssdc.gsfc.nasa.gov/planetary/lunarprosp.html | NASA NSSDCA (last updated 28 Jan 2022) | launch mass 296 kg, dry mass 158 kg, 100 km polar orbit, one-year nominal mission, instrument list | 14 Nov 2026 | Lunar Prospector entry in `missions.json` | An older NASA page and Wikipedia give dry mass 126 kg; the current page is used. Confirm before the demo |
| KPLO/Danuri Launch Press Kit, Aug 2022 | https://shadowcam.im-ldi.com/KPLO_english_press_kit.pdf | NASA (NASA-branded PDF hosted by the ShadowCam team) with KARI | launch weight 678 kg, nominal 100 +/- 30 km orbit, one-year primary mission, six payloads | 14 Nov 2026 | KPLO entry in `missions.json` | No dry mass in the press kit, so none stored. Other sites give about 550 kg dry mass but also say total mass grew from 550 to 678 kg, so that figure is unclear |

`missions.json` holds LRO, Lunar Prospector and KPLO only. Other orbiters will be added after their figures are copied from a NASA, ISRO or KARI page.

### 1.2 Illustrative: orbit and simulation assumptions
| Value | Where | Note |
|---|---|---|
| `perilune_alt_km` and `apolune_alt_km` for the 100 km and 500 km orbits | `orbits.json` | Game design choice of altitude |
| `contact_h_per_day` (4, 5, 8 h) | `orbits.json` | TODO: replace with a calculated or published figure |
| `insertion_dv_ms` for 500 km (800 m/s) and elliptical (700 m/s) | `orbits.json` | TODO: no source found yet |
| Event effect sizes: solar storm x0.9 solar; battery fade x2; comms outage x0.5 contact; instrument overdraw x1.15 load; extra maneuver x1.2 delta-v | `events.json` | Game assumptions, not NASA figures. State this in the UI |
| Default simulation assumptions (`sunPhaseDeg` 0, all scales 1, fade 0.01 per month) | `js/sim/simulate.js` | Nominal run is a conservative baseline at phase 0. Fade mean is a game assumption |

### 1.3 Illustrative: game layer 
| Name | URL | Provider | Variables | Date accessed | Used for | Limitations |
|---|---|---|---|---|---|---|
| Achievement thresholds | data/achievements.json in our repo | Chosen by the team (ILLUSTRATIVE) | cost under 100 M USD, mass use under 80% of launcher capacity, 300 GB data, 3 critical events survived, link margin 0 dB, reliability above 90% | 15 Nov 2026 | achievements on the Report screen | game goals, not real-mission figures; no external source |
| Star rating bands | js/core/evaluate.js in our repo | Chosen by the team (ILLUSTRATIVE) | score bands 90 / 75 / 60 / 40 for 5 to 1 stars | 15 Nov 2026 | star rating and rating label | arbitrary cut-offs for the game; not a mission-assurance standard |
| Failed-mission score cap | js/ui/resultsBanner.js in our repo | Chosen by the team (ILLUSTRATIVE) | score capped at 59 when the flown mission fails | 15 Nov 2026 | keeps FAILED from showing a high score | design choice for the game only |
| Failure explanations and advice | js/game/failureAnalysis.js in our repo | Written by the team (ILLUSTRATIVE) | text for NO_ORBIT, DELTAV_SHORT, BATTERY_DEPLETED, DATA_SHORTFALL, THERMAL_OVERLOAD | 15 Nov 2026 | post-mortem on the Report screen | general engineering advice; does not model every cause |


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