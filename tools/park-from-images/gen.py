"""Builds features/digital-park/data/park.generated.ts from the two reference images.

clean.jpg  : aerial render (layout: pavement, water, trees)
marked.jpg : same park with numbered markers (attraction positions)
"""
import cv2, numpy as np, json, base64, math, sys
rng = np.random.default_rng(7)
a = cv2.imread('clean.jpg'); hsv = cv2.cvtColor(a, cv2.COLOR_BGR2HSV)
Hh, Ww = a.shape[:2]

def register_marked_map():
    """Finds the perspective transform from the marked map onto the clean render, and the yellow marker discs."""
    b = cv2.imread('marked.jpg')[:, :1310]                    # the legend panel starts at x = 1310
    ga = cv2.cvtColor(a, cv2.COLOR_BGR2GRAY)
    gb = cv2.resize(cv2.cvtColor(b, cv2.COLOR_BGR2GRAY), None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)
    sift = cv2.SIFT_create(20000, contrastThreshold=0.02)
    ka, da = sift.detectAndCompute(ga, None); kb, db = sift.detectAndCompute(gb, None)
    matches = cv2.FlannBasedMatcher(dict(algorithm=1, trees=5), dict(checks=80)).knnMatch(db, da, k=2)
    good = [m for m, n in matches if m.distance < 0.75 * n.distance]
    src = np.float32([kb[g.queryIdx].pt for g in good]) / 2; dst = np.float32([ka[g.trainIdx].pt for g in good])
    Hm, _ = cv2.findHomography(src, dst, cv2.RANSAC, 5)
    m = cv2.inRange(cv2.cvtColor(b, cv2.COLOR_BGR2HSV), (22, 150, 200), (34, 255, 255))
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8))
    n, _, st, cen = cv2.connectedComponentsWithStats(m)
    found = [(round(cen[i][0]), round(cen[i][1]), int(st[i][2]), int(st[i][3]), int(st[i][4])) for i in range(1, n)
             if st[i][4] > 180 and 14 < st[i][2] < 40 and 14 < st[i][3] < 40]
    return Hm, sorted(found, key=lambda t: (t[1], t[0]))
import os
if os.path.exists('H.npy') and os.path.exists('blobs.json'):
    H = np.load('H.npy'); blobs_cached = json.load(open('blobs.json'))
else:
    H, blobs_cached = register_marked_map()

# ---------------------------------------------------------------- camera model
# The render is a perspective view pitched down at the ground. Undo it so that
# distances on the ground are consistent: rows nearer the camera (lower in the
# image) are drawn larger and less squashed than rows far away.
S = 0.08            # world units per pixel at the reference row
Y0, YH = 1000.0, -5300.0   # reference row, horizon row
F0 = 0.72           # vertical squash at the reference row
CX = Ww / 2
KZ = (S / F0) * (Y0 - YH) ** 2
def to_world(x, y):
    s = (y - YH) / (Y0 - YH)
    return ((x - CX) / s * S, KZ * (1 / (Y0 - YH) - 1 / (y - YH)))
def to_image(X, Z):
    y = YH + 1 / (1 / (Y0 - YH) - Z / KZ)
    s = (y - YH) / (Y0 - YH)
    return (X / S * s + CX, y)

# ---------------------------------------------------------------- image-space masks
B, G, R = [a[:, :, i].astype(int) for i in range(3)]
pav = ((hsv[:, :, 1] < 52) & (hsv[:, :, 2] > 140) & (hsv[:, :, 2] < 232) & (B >= G - 6) & (B >= R - 4)).astype(np.uint8) * 255
wat = cv2.inRange(hsv, (88, 90, 120), (108, 255, 255))
tree = cv2.inRange(hsv, (33, 80, 25), (80, 255, 135))

# Park outline (inside the boundary wall, plus the perimeter road and Turbo Force pad).
PARK = np.array([(262,150),(1010,128),(1722,96),(2412,668),(2412,1040),(2330,1250),(2240,1450),(2080,1510),(1920,1540),
                 (1640,1660),(1290,1640),(1160,1800),(960,1840),(900,1560),(820,1470),(0,830),(0,690)], np.float64)
Q = 2560 / 2412   # hand-read coordinates came from a preview shown slightly smaller than half size
PARK = (PARK * Q).astype(np.int32)
park_mask = np.zeros((Hh, Ww), np.uint8); cv2.fillPoly(park_mask, [PARK], 255)
# Roofs and walls that share the pavement colour.
NOT_PAVEMENT = [
    [(262,120),(560,120),(560,330),(262,330)],            # service building, north-west corner
    [(1880,380),(2200,380),(2200,620),(1880,620)],        # You Are The Star hall
    [(1240,600),(1470,600),(1470,790),(1240,790)],        # Summer Garden parasols
    [(1420,540),(1600,540),(1600,700),(1420,700)],        # Summer Garden kitchen
    [(2230,760),(2560,760),(2560,1100),(2230,1100)],      # building outside the east wall
    [(1720,1390),(1930,1390),(1930,1560),(1720,1560)],    # gate house
]
# Walkways the colour rule misses, traced by hand on clean.jpg (full-size pixels, not Q-scaled).
# Summer Garden walk: the shaded road between the Summer Garden building and the Z Force lawn,
# running down from the Giant Frisbee / Z Force road and turning along the front of the building.
# It sits in the building's shadow, so it reads too dark for the pavement rule above.
FORCED_PAVEMENT = [
    [(1631,595),(1703,598),(1709,632),(1709,714),(1706,758),(1688,746),(1650,738),(1594,744),
     (1562,750),(1549,736),(1562,728),(1594,725),(1662,714),(1672,695),(1669,670),(1650,626)],
]
pav_raw = pav
canopy = cv2.inRange(hsv, (30, 60, 20), (85, 255, 150))
shadow = ((hsv[:, :, 1] < 70) & (hsv[:, :, 2] > 55) & (hsv[:, :, 2] <= 140)).astype(np.uint8) * 255
cover = (canopy | shadow) & park_mask
def image_pavement(forced):
    """Pavement in image space. `forced` adds the hand-traced walkways; without them the result is
    exactly what the first version of the park used, which keeps the tree layout stable (see trees)."""
    pav = pav_raw.copy()
    for poly in NOT_PAVEMENT: cv2.fillPoly(pav, [(np.array(poly, np.float64) * Q).astype(np.int32)], 0)
    if forced:
        for poly in FORCED_PAVEMENT: cv2.fillPoly(pav, [np.array(poly, np.int32)], 255)
    pav &= park_mask
    pav = cv2.morphologyEx(pav, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
    # Tree canopies and their shadows hide strips of paving in an oblique view. Where
    # one touches paving, assume the paving carries on underneath it for a short way.
    for _ in range(2):
        reach = cv2.dilate(pav, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (27, 27)))
        pav = pav | (reach & cover)
    return cv2.morphologyEx(pav, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (13, 13)))
pav_base = image_pavement(False)
pav = image_pavement(True)
wat = cv2.morphologyEx(wat, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7)))
wat = cv2.morphologyEx(wat, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (31, 31)))
# Tree canopies sit above their trunks in an oblique view: slide them down to ground level.
tree = cv2.morphologyEx(tree, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)))
tree = np.roll(tree, 26, axis=0)

# ---------------------------------------------------------------- top-down rasters
RES = 0.2  # world units per raster pixel
xs = [to_world(x, y)[0] for x, y in [(0, 60), (Ww, 60), (0, Hh), (Ww, Hh)]]
zs = [to_world(0, 60)[1], to_world(0, Hh)[1]]
X0, X1, Z0, Z1 = math.floor(min(xs)), math.ceil(max(xs)), math.floor(zs[0]), math.ceil(zs[1])
TW, TH = int((X1 - X0) / RES), int((Z1 - Z0) / RES)
gx, gz = np.meshgrid(X0 + (np.arange(TW) + 0.5) * RES, Z0 + (np.arange(TH) + 0.5) * RES)
iy = YH + 1 / (1 / (Y0 - YH) - gz / KZ); isc = (iy - YH) / (Y0 - YH); ix = gx / S * isc + CX
mapx, mapy = ix.astype(np.float32), iy.astype(np.float32)
warp = lambda m: cv2.remap(m, mapx, mapy, cv2.INTER_NEAREST, borderValue=0)
pav_t, wat_t, tree_t, park_t = warp(pav), warp(wat), warp(tree), warp(park_mask)
pav_t_base = warp(pav_base)
img_t = cv2.remap(a, mapx, mapy, cv2.INTER_LINEAR, borderValue=(255, 255, 255))
def w2t(X, Z): return ((X - X0) / RES, (Z - Z0) / RES)

# Walkable ground the aerial image hides, confirmed by the park team. In world units (x, z).
FORCED_PAVEMENT_WORLD = [
    # The path under the tree cluster between Space Trainer and Turbo Force, joining the road along
    # the tree line to the road that curves down to Turbo Force. The canopies hide it in the render.
    [(-28, 44), (-22, 43.5), (-19.5, 46), (-19.5, 50), (-15, 51.5), (-14, 56), (-18, 57.5), (-24, 56.5), (-29, 55)],
    # Summer Garden parasol terrace: link from the terrace to the walk in front of the kitchen.
    [(19, -34.5), (24, -34), (24, -28.5), (19, -28.5)],
]
FORCED_CIRCLES_WORLD = [(12.8, -31.7, 8.5)]   # Summer Garden parasol terrace: walkable under the umbrellas
for poly in FORCED_PAVEMENT_WORLD:
    cv2.fillPoly(pav_t, [np.array([w2t(x, z) for x, z in poly]).round().astype(np.int32)], 255)
for x, z, r in FORCED_CIRCLES_WORLD:
    cx, cz = w2t(x, z); cv2.circle(pav_t, (round(cx), round(cz)), round(r / RES), 255, -1)

def largest(m):
    n, lab, st, _ = cv2.connectedComponentsWithStats(m, connectivity=4)
    if n < 2: return m
    k = 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA])); return (lab == k).astype(np.uint8) * 255
def fill_small_holes(m, max_area_px):
    inv = cv2.bitwise_not(m); n, lab, st, _ = cv2.connectedComponentsWithStats(inv, connectivity=4)
    out = m.copy()
    for i in range(1, n):
        if st[i, cv2.CC_STAT_AREA] < max_area_px: out[lab == i] = 255
    return out

# Water: keep the real pools only.
n, lab, st, cen = cv2.connectedComponentsWithStats(wat_t & park_t, connectivity=8)
water = np.zeros_like(wat_t); water_info = []
for i in range(1, n):
    area_u = st[i, cv2.CC_STAT_AREA] * RES * RES
    if area_u > 60:
        water[lab == i] = 255; water_info.append((round(X0 + cen[i][0] * RES, 1), round(Z0 + cen[i][1] * RES, 1), round(area_u)))
water = cv2.morphologyEx(water, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (19, 19)))
water = fill_small_holes(water, int(60 / RES / RES))
pav_t[water > 0] = 0; pav_t_base[water > 0] = 0
_n, _lab, _st, _ = cv2.connectedComponentsWithStats(pav_t_base, connectivity=4)   # base: keeps the random sequence (and so the trees) unchanged
_col = rng.integers(60, 255, (_n, 3)).astype(np.uint8); _col[0] = 0
_order = np.argsort(-_st[1:, cv2.CC_STAT_AREA])[:8] + 1
print('pavement components (area u2):', [int(_st[i, cv2.CC_STAT_AREA] * RES * RES) for i in _order])
cv2.imwrite('dbg_comp.jpg', cv2.addWeighted(img_t, 0.35, _col[_lab], 0.65, 0))
pav_t = fill_small_holes(largest(pav_t), int(7 / RES / RES))   # specks left by tree canopies over paving
pav_t_base = fill_small_holes(largest(pav_t_base), int(7 / RES / RES))
print('world x %d..%d  z %d..%d   raster %dx%d' % (X0, X1, Z0, Z1, TW, TH)); print('water bodies (x, z, area):', water_info)
np.save('pav_t.npy', pav_t); np.save('water_t.npy', water); np.save('tree_t.npy', tree_t)
cv2.imwrite('img_t.jpg', img_t)
json.dump(dict(X0=X0, X1=X1, Z0=Z0, Z1=Z1, RES=RES), open('frame.json', 'w'))

# ---------------------------------------------------------------- markers
blobs = blobs_cached
LABELS = ['19','20','B','I','J','C','N','21','K','16','25','17','18','30','22','15','33','32','H','14','L','13','26','E','8','23','12','G','24','9','7','31','11','F','10','M','27','A','6',None,'4','29','28','5','3','2','D','1']
pos = {}
for (x, y, w, h, ar), lab_ in zip(blobs, LABELS):
    if lab_ is None: continue
    p = cv2.perspectiveTransform(np.float32([[[x, y + 30]]]), H)[0, 0]   # pin tip is 30 px below the disc centre
    pos[lab_] = (float(p[0]), float(p[1]))
json.dump(pos, open('marker_px.json', 'w'), indent=0)
dbg = cv2.resize(a, None, fx=0.5, fy=0.5)
for k, (x, y) in pos.items():
    cv2.circle(dbg, (int(x / 2), int(y / 2)), 5, (0, 0, 255), -1); cv2.putText(dbg, k, (int(x / 2) + 6, int(y / 2) - 6), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 3); cv2.putText(dbg, k, (int(x / 2) + 6, int(y / 2) - 6), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 255), 2)
cv2.polylines(dbg, [(PARK // 2).reshape(-1, 1, 2)], True, (255, 0, 255), 2)
cv2.imwrite('dbg_markers.jpg', dbg)
top = img_t.copy(); top[pav_t > 0] = (0.5 * top[pav_t > 0] + 0.5 * np.array([0, 0, 255])).astype(np.uint8); top[water > 0] = (255, 0, 255)
for k, (x, y) in pos.items():
    X, Z = to_world(x, y); tx, tz = w2t(X, Z); cv2.circle(top, (int(tx), int(tz)), 6, (0, 255, 255), -1); cv2.putText(top, k, (int(tx) + 7, int(tz) - 7), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 0), 2)
cv2.imwrite('dbg_top.jpg', top)

# ================================================================ attractions
# Model centres in clean-image pixels where the pin tip isn't on the structure itself.
OVERRIDE = {'2':(1100,1620),'1':(1490,1520),'25':(1925,365),'C':(1770,265),'24':(1610,804),'22':(1336,524),'17':(700,420),
            '18':(1024,392),'H':(144,556),'15':(704,580),'8':(830,700),'12':(136,736),'9':(610,830),'F':(794,840),'7':(976,810),
            '6':(1036,1050),'4':(1280,1120),'29':(1580,1144),'3':(1170,1340),'5':(940,1260),'27':(2080,990),'28':(2070,1180),
            'D':(2030,1380),'26':(1980,660)}
pos.update({k: (x * Q, y * Q) for k, (x, y) in OVERRIDE.items()})
FAM, HIGH, MID, KIDS = 'Family ride', 'High thrill', 'Mid thrill', 'Kids ride'
# code, name, category, kind, model, options (sizes in world units, rot in degrees anticlockwise seen from above), solid
A_ = [
 ('1','Rush Hour','ride',FAM,'hall',dict(w=26,d=11,h=5,rot=-28,color='#EDE6D2',accent='#F2A900'),'rect'),
 ('2','Turbo Force','ride',HIGH,'arm',dict(h=13,color='#E65AA0',accent='#FFC53D'),4),
 ('3','Samba Balloon','ride',FAM,'spinner',dict(variant='balloon',arms=8,r=4.5,color='#FF5D73',accent='#3D8BFF'),5),
 ('4','Delta Hoppla','ride',MID,'ferris',dict(r=4,color='#FFC53D',accent='#E5383B'),5),
 ('5','Space Trainer','ride',MID,'arm',dict(h=8,color='#6B5BD6',accent='#3DDC97',variant='gyro'),4.5),
 ('6','Magic Bike','ride',FAM,'spinner',dict(variant='pod',arms=6,r=4,color='#FF8A3D',accent='#3D8BFF'),4.5),
 ('7',"Surf's Up",'ride',FAM,'surf',dict(len=18,rot=-78,color='#FFFFFF',accent='#FF5D73'),0),
 ('8','Kite Flyer','ride',FAM,'spinner',dict(variant='kite',arms=6,r=4.5,tilt=0.28,color='#3D8BFF',accent='#FFC53D'),4.5),
 ('9','Sky Race','ride',FAM,'spinner',dict(variant='plane',arms=8,r=4.5,color='#E5383B',accent='#FFC53D'),4.5),
 ('10','Junior Jet','ride',KIDS,'spinner',dict(variant='plane',arms=6,r=3.2,color='#FFC53D',accent='#E5383B'),3.5),
 ('11','Crazy Surf','ride',FAM,'halfpipe',dict(w=8,d=4,rot=-25,color='#3D8BFF',accent='#FFC53D'),4),
 ('12','Wave Blaster','ride',FAM,'spinner',dict(variant='pod',arms=8,r=4.5,color='#17A398',accent='#FFC53D'),4.5),
 ('13',"Jump'in Star",'ride',FAM,'tower',dict(h=7,r=0.5,color='#FFC53D',accent='#E5383B',top='ring'),3),
 ('14','Mini Ferris Wheel','ride',KIDS,'ferris',dict(r=4.5,color='#E5383B',accent='#FFC53D'),4.5),
 ('15','Water Mania','ride',FAM,'spinner',dict(variant='pod',arms=6,r=4.5,color='#2FC3DA',accent='#FFC53D',wet=True),4.5),
 ('16','Truck n Trail','ride',KIDS,'track',dict(rx=9,rz=4.2,rot=12,color='#8D8F96',accent='#E5383B'),'rect:19x8.5'),
 ('17','Sky Screamer','ride',MID,'tower',dict(h=24,r=0.7,color='#E9EEF2',accent='#3D8BFF',top='star'),3.2),
 ('18','Top Spin Suspended','ride',HIGH,'topspin',dict(w=10,h=8,rot=0,color='#FFC53D',accent='#3D8BFF'),6),
 ('19','5D Theatre / Lanka Dahan','attraction','','hall',dict(w=13,d=10,h=6.5,rot=0,color='#DCDDE6',accent='#1F3A6E',sign='#E5383B'),'rect'),
 ('20','Mega Disco','ride',MID,'disco',dict(len=17,rot=3,color='#F2C230',accent='#E5383B'),'rect:18x6'),
 ('21','Super Splash','ride',MID,'splash',dict(h=24,rot=28,color='#2A56B8',accent='#EDE6D2'),0),
 ('22','Giant Frisbee','ride',HIGH,'frisbee',dict(h=15,rot=-12,color='#F28A1E',accent='#2A56B8'),6),
 ('23','Flying Carousel','ride',MID,'carousel',dict(variant='umbrella',r=4.5,h=7,color='#E5383B',accent='#FFC53D'),5),
 ('24','Z Force','ride',MID,'tower',dict(h=24,r=0.8,color='#FF5D73',accent='#FFC53D',top='ring',rainbow=True,base=3.4),3.6),
 ('25','Flipping Arm','ride',HIGH,'arm',dict(h=6.5,color='#E5383B',accent='#FFFFFF'),3.5),
 ('26','Air Race','ride',MID,'spinner',dict(variant='plane',arms=6,r=5.5,tilt=0.15,color='#2A56B8',accent='#E5383B'),5.5),
 ('27','Demolition Derby','ride',FAM,'bumper',dict(rx=6.5,rz=4.5,rot=-18,color='#E5383B',accent='#FFC53D'),5),
 ('28','Galleon','ride',FAM,'ship',dict(h=8,rot=-30,color='#8A5A33',accent='#FFC53D'),0),
 ('29','Carnival Carousel','ride',FAM,'carousel',dict(variant='tent',r=6,h=6,color='#2A56B8',accent='#FFFFFF'),6.5),
 ('30','You Are The Star','attraction','','hall',dict(w=28,d=12,h=7,rot=-40,color='#F4F4F0',accent='#1F3A6E'),'rect'),
 ('31','Musical Fountain','attraction','','fountain',dict(variant='lake',r=5),0),
 ('32','Dynamic Fountain','attraction','','fountain',dict(variant='plaza',r=3.2),3.2),
 ('33','Kids Play Area','attraction','','playground',dict(r=6,color='#FF5D73',accent='#3D8BFF'),4.5),
 ('A','Windmill Cafe','food','Mini meals','windmill',dict(w=22,d=14,h=5,rot=-28,color='#BFE3F5',accent='#1F3A6E'),'rect'),
 ('B','Zen Forest','food','Multi-cuisine','hall',dict(w=24,d=14,h=5,rot=0,color='#9C6634',accent='#1F3A6E'),'rect'),
 ('C','The Deck','food','Oriental','hall',dict(w=16,d=9,h=4,rot=-38,color='#B08C5A',accent='#7A5C3A'),'rect'),
 ('D','Santa Maria','food','Snacks','shipcafe',dict(w=12,d=10,h=4,rot=-25,color='#B9552F',accent='#1F3A6E'),'rect'),
 ('E','Summer Garden','food','Pizza & burgers','garden',dict(w=10.5,d=7.5,h=4.5,rot=-35,color='#F4F4F0',accent='#2E7D4F'),'rect'),
 ('F','Swirl Station','food','Cold Stone ice cream','kiosk',dict(w=4,d=4,h=3,rot=-20,color='#F7C6E0',accent='#C2408C'),'rect'),
 ('G','First Aid','service','','kiosk',dict(w=4.5,d=4,h=3,rot=0,color='#FFFFFF',accent='#E5383B',cross=True),'rect'),
 ('H','Platform 93%','food','Kiddie snacks','kiosk',dict(w=9,d=3.5,h=3.2,rot=62,color='#F28A1E',accent='#2A56B8'),'rect'),
 ('I','The Chatery','food','Chaat counter','kiosk',dict(w=8,d=3.5,h=3,rot=-24,color='#A9713F',accent='#6E4423'),'rect'),
 ('J','Essentials','service','Merchandise','kiosk',dict(w=4.5,d=4,h=3,rot=0,color='#FFF1D6',accent='#E5383B'),'rect'),
 ('K','The Smoothie Life','food','Shakes & smoothies','kiosk',dict(w=4,d=4,h=3,rot=0,color='#FFE9A8',accent='#3DAA5C'),'rect'),
 ('L','Cream Scream','food','Cakes & bakes','kiosk',dict(w=5,d=4.5,h=3.2,rot=-30,color='#FFF1D6',accent='#C2408C'),'rect'),
 ('M','Refuel','food','Snacks & beverages','kiosk',dict(w=5,d=4,h=3,rot=-20,color='#DDEBFF',accent='#2A56B8'),'rect'),
 ('N','Maze Garden','attraction','','maze',dict(w=11,d=8,rot=-10,color='#2E7D4F'),0),
]
# Unnumbered structures that help people get their bearings.
LANDMARKS = [
 dict(id='service-building', kind='hall', px=(700/2*1+60,455/2), opts=dict(w=20,d=18,h=8,rot=-3,color='#F4F4F0',accent='#1F3A6E')),
 dict(id='gate-house', kind='gate', px=(1830,1470), opts=dict(w=15,d=7,h=5,rot=-40,color='#DCE6EC',accent='#5B7C99')),
 dict(id='entrance-plaza', kind='plaza', px=(2010,1710), opts=dict(r=19)),
 dict(id='east-building', kind='hall', px=(2360,900), opts=dict(w=13,d=10,h=10,rot=-35,color='#D9DBD6',accent='#B9BDB6')),
]
LANDMARKS[0]['px'] = (410, 225)
WORLD_OVERRIDE = {'E': (27.6, -41.3)}     # the kitchen building; its parasols are a separate landmark
WORLD_LANDMARKS = [
 dict(id='summer-garden-parasols', kind='parasols', x=12.8, z=-31.7, opts=dict(r=8)),   # no solid: visitors walk under the umbrellas
 dict(id='round-pool', kind='pool', x=54.8, z=-14.7, opts=dict(r=3.6), solid=dict(r=4)),
]

def solid_shape(code, opts, solid):
    if solid == 'rect': return dict(w=opts['w'] + 1, d=opts['d'] + 1, rot=opts.get('rot', 0))
    if isinstance(solid, str): w, d = solid.split(':')[1].split('x'); return dict(w=float(w), d=float(d), rot=opts.get('rot', 0))
    return dict(r=solid) if solid else None

attractions = []
for code, name, cat, kind, model, opts, solid in A_:
    X, Z = WORLD_OVERRIDE.get(code) or to_world(*pos[code])
    attractions.append(dict(code=code, name=name, category=cat, kind=kind, model=model, x=round(X, 1), z=round(Z, 1), opts=opts, solid=solid_shape(code, opts, solid)))
for lm in LANDMARKS:
    X, Z = to_world(lm['px'][0] * Q, lm['px'][1] * Q); lm['x'], lm['z'] = round(X, 1), round(Z, 1)
    lm['solid'] = dict(w=lm['opts']['w'] + 1, d=lm['opts']['d'] + 1, rot=lm['opts'].get('rot', 0)) if 'w' in lm['opts'] else None

LANDMARKS += WORLD_LANDMARKS

# ================================================================ walk grid
CELL = 0.6; K = int(round(CELL / RES))
cols, rows = TW // K, TH // K
blocks = (pav_t[:rows * K, :cols * K] > 0).reshape(rows, K, cols, K).sum(axis=(1, 3))
grid = (blocks >= 6).astype(np.uint8)

def stamp(g, x, z, solid):
    """Mark an attraction's solid footprint as not walkable (same maths as lib/walkgrid.ts)."""
    if not solid: return
    cz, cx = np.mgrid[0:rows, 0:cols]
    wx = X0 + (cx + 0.5) * CELL - x; wz = Z0 + (cz + 0.5) * CELL - z
    if 'r' in solid: g[(wx * wx + wz * wz) <= solid['r'] ** 2] = 0
    else:
        t = math.radians(solid['rot']); c, s = math.cos(t), math.sin(t)
        lx = wx * c - wz * s; lz = wx * s + wz * c      # into the building's own axes
        g[(np.abs(lx) <= solid['w'] / 2) & (np.abs(lz) <= solid['d'] / 2)] = 0
g2 = grid.copy()
for it in attractions + LANDMARKS: stamp(g2, it['x'], it['z'], it.get('solid'))
n, lab, st, _ = cv2.connectedComponentsWithStats(g2, connectivity=4)
main = 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA]))
lost = int(g2.sum() - st[main, cv2.CC_STAT_AREA])
print('grid %dx%d  walkable %d cells, %d cells cut off by solids' % (cols, rows, int(g2.sum()), lost))
walk = (lab == main)
# nearest reachable cell to each attraction, to see how far its "door" ends up
wy, wx_ = np.nonzero(walk); wxw = X0 + (wx_ + 0.5) * CELL; wzw = Z0 + (wy + 0.5) * CELL
for it in attractions:
    d = np.hypot(wxw - it['x'], wzw - it['z']); it['doorDist'] = round(float(d.min()), 1)
print('door distances:', {it['code']: it['doorDist'] for it in attractions if it['doorDist'] > 9})
bits = np.packbits(grid.ravel()).tobytes()   # unstamped: solids are applied at load time from park.ts

# ================================================================ outlines
def polygons(mask, eps, min_area_u, min_hole_u):
    cs, hier = cv2.findContours(mask, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
    out = []
    conv = lambda c: [[round(X0 + float(p[0][0]) * RES, 2), round(Z0 + float(p[0][1]) * RES, 2)] for p in cv2.approxPolyDP(c, eps / RES, True)]
    if hier is None: return out
    for i, (c, h) in enumerate(zip(cs, hier[0])):
        if h[3] != -1 or cv2.contourArea(c) * RES * RES < min_area_u: continue
        holes = []; j = h[2]
        while j != -1:
            if cv2.contourArea(cs[j]) * RES * RES >= min_hole_u:
                hp = conv(cs[j])
                if len(hp) >= 3: holes.append(hp)
            j = hier[0][j][0]
        out.append(dict(outer=conv(c), holes=holes))
    return out
pav_draw = cv2.morphologyEx(pav_t, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
pav_draw = cv2.GaussianBlur(pav_draw, (0, 0), 3.4); pav_draw = (pav_draw > 127).astype(np.uint8) * 255
pavement = polygons(pav_draw, 0.2, 20, 5)
wsm = cv2.GaussianBlur(water, (0, 0), 2.5); wsm = (wsm > 127).astype(np.uint8) * 255
waters = polygons(wsm, 0.25, 40, 9999)
print('pavement polys %d, points %d, holes %d | water polys %d' % (len(pavement), sum(len(p['outer']) + sum(len(h) for h in p['holes']) for p in pavement), sum(len(p['holes']) for p in pavement), len(waters)))

# ================================================================ trees
# Footprints changed after the first build (Summer Garden trimmed, parasols made walkable). Trees keep the
# clearance they had then, so the random layout of every other tree in the park stays exactly the same.
TREE_CLEARANCE_AS_FIRST_BUILT = {'E': 9.0, 'summer-garden-parasols': 10.5}
keep_out = cv2.dilate(pav_t_base, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15))) | cv2.dilate(water, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (11, 11)))
cand = (tree_t > 0) & (keep_out == 0)
for it in attractions + LANDMARKS:
    tx, tz = w2t(it['x'], it['z']); rad = 9
    if it.get('solid'): rad = max(it['solid'].get('r', 0), it['solid'].get('w', 0) / 2) + 2.5
    rad = TREE_CLEARANCE_AS_FIRST_BUILT.get(it.get('code') or it.get('id'), rad)
    if it.get('kind') == 'plaza': rad = it['opts']['r'] + 2
    cv2.circle(keep_out, (int(tx), int(tz)), int(rad / RES), 255, -1)
cand &= keep_out == 0
ys, xs_ = np.nonzero(cand); order = rng.permutation(len(ys)); trees = []
occ = np.zeros_like(pav_t)
for i in order:
    y, x = ys[i], xs_[i]
    if occ[y, x]: continue
    inside = park_t[y, x] > 0
    cv2.circle(occ, (int(x), int(y)), int((4.2 if inside else 6.5) / RES), 255, -1)
    trees.append([round(X0 + x * RES, 1), round(Z0 + y * RES, 1), round(float(rng.uniform(0.85, 1.25) * (1 if inside else 1.35)), 2)])
# Trees come from the pavement before the hand-traced walkways, so adding a walkway never reshuffles
# trees elsewhere. Any that would stand on an added walkway are left out.
added = cv2.dilate(((pav_t > 0) & (pav_t_base == 0)).astype(np.uint8) * 255, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7)))
trees = [t for t in trees if not added[int(round((t[1] - Z0) / RES)), int(round((t[0] - X0) / RES))]]
print('trees', len(trees))

WALLS = [[to_world(p[0] * Q, p[1] * Q) for p in seg] for seg in [[(10,640),(262,150),(1010,128),(1722,96),(2412,668),(2550,790)]]]
WALLS = [[[round(x, 1), round(z, 1)] for x, z in seg] for seg in WALLS]

json.dump(dict(attractions=attractions, landmarks=[{k: v for k, v in lm.items() if k != 'px'} for lm in LANDMARKS], frame=dict(X0=X0, Z0=Z0, X1=X1, Z1=Z1, CELL=CELL, cols=int(cols), rows=int(rows)),
               grid=base64.b64encode(bits).decode(), pavement=pavement, water=waters, trees=trees, walls=WALLS), open('layout.json', 'w'))

# debug picture of the final plan
plan = np.full((TH, TW, 3), (106, 203, 140), np.uint8); plan[pav_draw > 0] = (200, 196, 190); plan[wsm > 0] = (218, 195, 47)
gbig = cv2.resize(walk.astype(np.uint8), (cols * K, rows * K), interpolation=cv2.INTER_NEAREST)
edge = cv2.morphologyEx(gbig, cv2.MORPH_GRADIENT, np.ones((3, 3), np.uint8)); plan[:rows * K, :cols * K][edge > 0] = (60, 60, 200)
for t in trees: cv2.circle(plan, tuple(int(v) for v in w2t(t[0], t[1])), 6, (60, 130, 50), -1)
for it in attractions:
    p = tuple(int(v) for v in w2t(it['x'], it['z'])); cv2.circle(plan, p, 5, (0, 0, 0), -1); cv2.putText(plan, it['code'], (p[0] + 6, p[1] - 6), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 120), 2)
cv2.imwrite('dbg_plan.jpg', plan)

# ================================================================ emit TypeScript
OUT = sys.argv[1] if len(sys.argv) > 1 else '.'
def tsv(v):
    if isinstance(v, bool): return 'true' if v else 'false'
    if isinstance(v, str): return "'" + v.replace("'", "\\'") + "'"
    if isinstance(v, dict): return '{ ' + ', '.join(f'{k}: {tsv(x)}' for k, x in v.items()) + ' }'
    if isinstance(v, float) and v == int(v): return str(int(v))
    return str(v)
SPAWN_W = to_world(1760 * Q, 1330 * Q)
THRILL = {FAM: 'family', HIGH: 'high', MID: 'mid', KIDS: 'kids'}
# Facilities at a place, as confirmed by the park team (not read from the images).
AMENITIES = {'A': ['restroom', 'water'], 'B': ['restroom', 'water'], 'D': ['restroom'], 'H': ['restroom'], 'E': ['water']}
L = ["import type { Attraction, Category, Landmark, Vec2 } from './types';", '',
'/**',
' * The real park, as data. Positions were measured from the two reference images',
' * (aerial render for layout, marked map for which attraction is which) and are',
' * in world units: x runs left to right across the map, z runs top to bottom,',
' * exactly as the map is drawn. `position` is [x, y, z] with y (height) at 0.',
' *',
' * To move, rename or restyle something, edit it here. Walkable ground, water',
' * outlines and trees are in park.generated.ts. After editing, run `npm run verify`.',
' */', '',
'/** First estimate of the map scale. Once GPS is calibrated, distances use the measured scale instead (lib/geo.ts EFFECTIVE_METRES_PER_UNIT). */',
'export const METRES_PER_UNIT = 1.6;',
'export const WALK_METRES_PER_MIN = 70;', '',
'/** Where the visitor starts: just inside the entrance gate (snapped to the nearest walkable spot at load). */',
f'export const SPAWN: Vec2 = {{ x: {SPAWN_W[0]:.1f}, z: {SPAWN_W[1]:.1f} }};', '',
'export const CATEGORIES: { id: Category; label: string }[] = [',
"  { id: 'ride', label: 'Rides' },", "  { id: 'attraction', label: 'Attractions' },", "  { id: 'food', label: 'Food' },", "  { id: 'service', label: 'Services' },", '];', '',
'/** Numbered 1-33 and lettered A-N exactly as on the park map legend. */',
'export const ATTRACTIONS: Attraction[] = [']
for it in attractions:
    f = [f"id: '{it['code']}'", f'name: {tsv(it["name"])}', f"category: '{it['category']}'", f'kind: {tsv(it["kind"])}']
    if it['kind'] in THRILL: f.append(f"type: '{THRILL[it['kind']]}'")
    f += [f"position: [{tsv(it['x'])}, 0, {tsv(it['z'])}]", f"model: '{it['model']}'", f'opts: {tsv(it["opts"])}']
    if it['solid']: f.append(f'solid: {tsv(it["solid"])}')
    if it['code'] in AMENITIES: f.append('amenities: [' + ', '.join(tsv(x) for x in AMENITIES[it['code']]) + ']')
    L.append('  { ' + ', '.join(f) + ' },')
L += ['];', '', '/** Unnumbered structures that help people get their bearings. */', 'export const LANDMARKS: Landmark[] = [']
for lm in LANDMARKS:
    f = [f"id: '{lm['id']}'", f"kind: '{lm['kind']}'", f"position: [{tsv(lm['x'])}, 0, {tsv(lm['z'])}]", f'opts: {tsv(lm["opts"])}']
    if lm.get('solid'): f.append(f'solid: {tsv(lm["solid"])}')
    L.append('  { ' + ', '.join(f) + ' },')
L += ['];', '', "export const getAttraction = (id: string | null | undefined) => ATTRACTIONS.find((a) => a.id === id) ?? null;", '']
open(f'{OUT}/park.ts', 'w').write('\n'.join(L))

pts = lambda poly: '[' + ','.join(f'[{p[0]},{p[1]}]' for p in poly) + ']'
G = ['// GENERATED by tools/park-from-images/gen.py from the reference images. Do not edit by hand.', '',
"import type { Outline } from './types';", '',
f'/** Walk grid: {cols} x {rows} cells of {CELL} units, row by row from the top-left, one bit per cell (1 = paved). */',
f'export const GRID = {{ cell: {CELL}, cols: {cols}, rows: {rows}, originX: {X0}, originZ: {Z0} }};',
f"export const GRID_BITS = '{base64.b64encode(bits).decode()}';", '',
'/** Paved ground: outer edges with the planted islands cut out as holes. Points are [x, z]. */',
'export const PAVEMENT: Outline[] = [']
for p in pavement: G.append('  { outer: ' + pts(p['outer']) + ', holes: [' + ','.join(pts(h) for h in p['holes']) + '] },')
G += ['];', '', '/** Pools and the lake. */', 'export const WATER: Outline[] = [']
for p in waters: G.append('  { outer: ' + pts(p['outer']) + ', holes: [] },')
G += ['];', '', '/** Trees as [x, z, scale]. */', 'export const TREES: [number, number, number][] = [' + ','.join(f'[{t[0]},{t[1]},{t[2]}]' for t in trees) + '];', '',
'/** Boundary wall as polylines of [x, z]. */', 'export const WALLS: [number, number][][] = [' + ','.join(pts(sg) for sg in WALLS) + '];', '']
open(f'{OUT}/park.generated.ts', 'w').write('\n'.join(G))
print('wrote', OUT, 'park.ts', len('\n'.join(L)), 'bytes; park.generated.ts', len('\n'.join(G)), 'bytes')