/**
 * Ride opening hours, from the park's "Ride Timing Update" sheet (RNA Timings).
 * Keyed by map code. Times are park time (IST), 24-hour 'HH:MM', and the same
 * every day for now. A place not listed here is always open: fountains, the
 * Kids Play Area, Maze Garden, food outlets and services.
 *
 * Rides with two sessions close for a break in between.
 */
export const RIDE_HOURS: Record<string, [string, string][]> = {
    '1': [['11:00', '18:00']], //                    Rush Hour
    '2': [['11:00', '17:30']], //                    Turbo Force
    '3': [['11:00', '13:00'], ['15:00', '18:00']], // Samba Balloon
    '4': [['11:00', '13:00'], ['15:00', '18:00']], // Delta Hoppla
    '5': [['14:00', '18:00']], //                    Space Trainer
    '6': [['11:00', '18:00']], //                    Magic Bike
    '7': [['13:00', '18:00']], //                    Surf's Up
    '8': [['13:00', '18:00']], //                    Kite Flyer
    '9': [['12:00', '18:00']], //                    Sky Race
    '10': [['12:00', '18:00']], //                   Junior Jet
    '11': [['12:00', '18:00']], //                   Crazy Surf
    '12': [['12:00', '18:00']], //                   Wave Blaster
    '13': [['12:00', '18:00']], //                   Jump'in Star
    '14': [['12:00', '18:00']], //                   Mini Ferris Wheel
    '15': [['13:00', '18:00']], //                   Water Mania
    '16': [['12:00', '18:00']], //                   Truck n Trail
    '17': [['12:00', '14:00'], ['15:00', '18:00']], // Sky Screamer
    '18': [['14:00', '18:00']], //                   Top Spin Suspended
    '19': [['13:00', '18:00']], //                   5D Theatre / Lanka Dahan
    '20': [['12:00', '18:00']], //                   Mega Disco
    '21': [['13:00', '18:00']], //                   Super Splash
    '22': [['12:00', '14:00'], ['15:00', '18:00']], // Giant Frisbee
    '23': [['14:00', '18:00']], //                   Flying Carousel
    '24': [['12:00', '18:00']], //                   Z Force
    '25': [['11:00', '13:00'], ['15:00', '18:00']], // Flipping Arm
    '26': [['11:00', '13:00'], ['15:00', '18:00']], // Air Race
    '27': [['11:00', '18:00']], //                   Demolition Derby
    '28': [['11:00', '18:00']], //                   Galleon
    '29': [['11:00', '18:00']], //                   Carnival Carousel
    '30': [['14:00', '18:00']], //                   You Are The Star
};