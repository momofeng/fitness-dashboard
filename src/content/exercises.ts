// 內建動作庫。id 為 kebab-case 且永久不改；課表範本以 id 引用。
// 時間型動作（plank、side-plank、farmer-walk、dead-hang）的 defaultRepRange 單位是秒，已在 cues 註明。
import type { Exercise } from './types';

export const EXERCISES: Exercise[] = [
  // 胸
  {
    id: 'barbell-bench-press', nameZh: '槓鈴臥推', aliases: ['臥推', '平板臥推', '槓鈴平板臥推', 'Bench Press'], nameEn: 'Barbell Bench Press',
    primary: ['chest'], secondary: ['frontDelt', 'triceps'], equipment: 'barbell', category: 'compound', loadType: 'external',
    defaultIncrementKg: 2.5, defaultRepRange: [5, 8],
    cues: '肩胛後收下壓、雙腳踩穩，槓鈴下放到乳頭下緣附近，前臂在底部保持垂直。推起時沿微微朝頭部的弧線，肩膀不聳、臀部不離椅。',
  },
  {
    id: 'incline-barbell-bench-press', nameZh: '槓鈴上斜臥推', aliases: ['上斜臥推', '上胸臥推', 'Incline Bench'], nameEn: 'Incline Barbell Bench Press',
    primary: ['chest'], secondary: ['frontDelt', 'triceps'], equipment: 'barbell', category: 'compound', loadType: 'external',
    defaultIncrementKg: 2.5, defaultRepRange: [6, 10],
    cues: '椅背調到約 30 度即可，角度太陡會變成肩推。槓鈴落在鎖骨下方的上胸位置，全程維持肩胛收緊。',
  },
  {
    id: 'smith-machine-bench-press', nameZh: '史密斯臥推', aliases: ['史密斯機臥推', 'Smith Bench Press'], nameEn: 'Smith Machine Bench Press',
    primary: ['chest'], secondary: ['frontDelt', 'triceps'], equipment: 'smith', category: 'compound', loadType: 'external',
    defaultIncrementKg: 2.5, defaultRepRange: [6, 10],
    cues: '先調整臥椅前後位置，讓下放時槓鈴落在乳頭附近、前臂接近垂直。固定軌道較穩，仍要收緊肩胛，推到頂端手肘不要用力鎖死。',
  },
  {
    id: 'dumbbell-bench-press', nameZh: '啞鈴臥推', aliases: ['啞鈴平板臥推', 'DB Bench'], nameEn: 'Dumbbell Bench Press',
    primary: ['chest'], secondary: ['frontDelt', 'triceps'], equipment: 'dumbbell', category: 'compound', loadType: 'external',
    defaultIncrementKg: 2, defaultRepRange: [6, 10],
    cues: '下放時手肘與身體約成 45 至 60 度，胸口有拉伸感再推起。推起軌跡微微向內收，頂端兩顆啞鈴不必互撞。',
  },
  {
    id: 'incline-dumbbell-press', nameZh: '啞鈴上斜臥推', aliases: ['上斜啞鈴推', '啞鈴上斜推舉', '上斜啞鈴臥推'], nameEn: 'Incline Dumbbell Press',
    primary: ['chest'], secondary: ['frontDelt', 'triceps'], equipment: 'dumbbell', category: 'compound', loadType: 'external',
    defaultIncrementKg: 2, defaultRepRange: [8, 12],
    cues: '椅背約 30 度，啞鈴從上胸兩側往上推、頂端稍微向內靠攏。下放要慢，肩胛維持貼緊椅背。',
  },
  {
    id: 'dumbbell-fly', nameZh: '啞鈴飛鳥', aliases: ['啞鈴夾胸', '平板飛鳥', '啞鈴平板飛鳥'], nameEn: 'Dumbbell Fly',
    primary: ['chest'], secondary: ['frontDelt'], equipment: 'dumbbell', category: 'isolation', loadType: 'external',
    defaultIncrementKg: 2, defaultRepRange: [10, 15],
    cues: '手肘微彎並固定角度，像抱大樹一樣畫弧打開，胸口有拉伸感就停，不要為了更深而讓肩膀被拉扯。選輕一點的重量，用胸收攏而不是用手推。',
  },
  {
    id: 'machine-chest-press', nameZh: '器械胸推', aliases: ['坐姿胸推機', '胸推機', 'Chest Press Machine'], nameEn: 'Machine Chest Press',
    primary: ['chest'], secondary: ['frontDelt', 'triceps'], equipment: 'machine', category: 'compound', loadType: 'external',
    defaultIncrementKg: 2.5, defaultRepRange: [8, 12],
    cues: '調座椅讓握把與胸口同高，肩胛貼緊椅背不要前聳。推到手肘接近伸直但不鎖死，回程控制速度不要讓配重砸下。',
  },
  {
    id: 'incline-machine-press', nameZh: '上斜器械胸推', aliases: ['上斜胸推機', '器械上斜推胸'], nameEn: 'Incline Machine Chest Press',
    primary: ['chest'], secondary: ['frontDelt', 'triceps'], equipment: 'machine', category: 'compound', loadType: 'external',
    defaultIncrementKg: 2.5, defaultRepRange: [8, 12],
    cues: '握把起點應落在上胸高度，座椅太低會變成肩推。推時想像把手肘往中間合攏，底部不要讓肩膀被配重往前拖。',
  },
  {
    id: 'pec-deck', nameZh: '蝴蝶機夾胸', aliases: ['蝴蝶機', '坐姿夾胸', '器械夾胸', 'Pec Fly Machine'], nameEn: 'Pec Deck Fly',
    primary: ['chest'], secondary: ['frontDelt'], equipment: 'machine', category: 'isolation', loadType: 'external',
    defaultIncrementKg: 2.5, defaultRepRange: [10, 15],
    cues: '背貼椅背、手肘與肩同高，用手臂畫弧向中間合攏並在頂端停一拍。回程只退到胸口有拉伸感，避免肩膀過度往後拉。',
  },
  {
    id: 'cable-fly', nameZh: '滑輪夾胸', aliases: ['繩索夾胸', '龍門架夾胸', '高位滑輪夾胸', 'Cable Crossover'], nameEn: 'Cable Fly',
    primary: ['chest'], secondary: ['frontDelt'], equipment: 'cable', category: 'isolation', loadType: 'external',
    defaultIncrementKg: 2.5, defaultRepRange: [10, 15],
    cues: '身體略前傾、一腳在前站穩，手肘微彎固定，雙手由外向下前方畫弧合攏。頂端把胸夾緊停一拍，回程控制到胸口有伸展為止。',
  },
  {
    id: 'low-to-high-cable-fly', nameZh: '低位滑輪上拉夾胸', aliases: ['低位夾胸', '上胸滑輪夾胸', '下往上夾胸'], nameEn: 'Low-to-High Cable Fly',
    primary: ['chest'], secondary: ['frontDelt'], equipment: 'cable', category: 'isolation', loadType: 'external',
    defaultIncrementKg: 2.5, defaultRepRange: [10, 15],
    cues: '滑輪設在低位，雙手由下往上、往臉前方合攏，著重上胸。軀幹保持穩定不借力，肩膀不要聳起。',
  },
  {
    id: 'push-up', nameZh: '伏地挺身', aliases: ['標準伏地挺身', 'Push-up'], nameEn: 'Push-up',
    primary: ['chest'], secondary: ['frontDelt', 'triceps', 'abs'], equipment: 'bodyweight', category: 'compound', loadType: 'bodyweight',
    defaultIncrementKg: 0, defaultRepRange: [10, 20],
    cues: '身體從頭到腳維持一直線，核心與臀部夾緊，手肘約朝後 45 度。下放到胸口接近地面，再完整推起。',
  },
  {
    id: 'dip', nameZh: '雙槓撐體', aliases: ['雙槓臂屈伸', '撐體', 'Dips'], nameEn: 'Dip',
    primary: ['chest', 'triceps'], secondary: ['frontDelt'], equipment: 'bodyweight', category: 'compound', loadType: 'bodyweightPlus',
    defaultIncrementKg: 2.5, defaultRepRange: [6, 10],
    cues: '身體微前傾偏重胸、直立偏重三頭。下放到上臂約與地面平行即可，肩膀不要聳起，也不要用力下沉到肩前側被拉扯。',
  },

  // 前三角
  {
    id: 'barbell-overhead-press', nameZh: '槓鈴肩推', aliases: ['站姿肩推', 'OHP', 'Overhead Press', '軍事推舉', '槓鈴推舉'], nameEn: 'Barbell Overhead Press',
    primary: ['frontDelt'], secondary: ['sideDelt', 'triceps'], equipment: 'barbell', category: 'compound', loadType: 'external',
    defaultIncrementKg: 2.5, defaultRepRange: [5, 8],
    cues: '臀部與腹部夾緊，避免腰椎過度反弓。槓鈴沿臉前方垂直推起，過頭頂後讓頭自然回到手臂之間，雙肩往上頂穩。',
  },
  {
    id: 'dumbbell-shoulder-press', nameZh: '啞鈴肩推', aliases: ['啞鈴推舉', '坐姿啞鈴肩推', 'DB Shoulder Press'], nameEn: 'Dumbbell Shoulder Press',
    primary: ['frontDelt'], secondary: ['sideDelt', 'triceps'], equipment: 'dumbbell', category: 'compound', loadType: 'external',
    defaultIncrementKg: 2, defaultRepRange: [6, 10],
    cues: '前臂在全程保持與地面垂直，啞鈴從耳朵兩側推到頭頂上方。坐姿時背貼緊椅背，不要用腰往後仰來借力。',
  },
  {
    id: 'machine-shoulder-press', nameZh: '器械肩推', aliases: ['坐姿肩推機', '肩推機', 'Shoulder Press Machine'], nameEn: 'Machine Shoulder Press',
    primary: ['frontDelt'], secondary: ['sideDelt', 'triceps'], equipment: 'machine', category: 'compound', loadType: 'external',
    defaultIncrementKg: 2.5, defaultRepRange: [8, 12],
    cues: '座椅高度調到握把起點約在下巴到肩膀之間，背貼緊椅背。往上推到手肘接近伸直，下放時控制速度，不要讓配重彈起。',
  },
  {
    id: 'arnold-press', nameZh: '阿諾推舉', aliases: ['阿諾肩推', 'Arnold Press'], nameEn: 'Arnold Press',
    primary: ['frontDelt', 'sideDelt'], secondary: ['triceps'], equipment: 'dumbbell', category: 'compound', loadType: 'external',
    defaultIncrementKg: 2, defaultRepRange: [8, 12],
    cues: '起始掌心朝向自己，邊往上推邊把手掌轉向前方，下放時反向轉回。用比一般肩推輕的重量，旋轉要順暢不卡肩。',
  },
  {
    id: 'dumbbell-front-raise', nameZh: '啞鈴前平舉', aliases: ['前平舉', 'Front Raise'], nameEn: 'Dumbbell Front Raise',
    primary: ['frontDelt'], secondary: ['sideDelt'], equipment: 'dumbbell', category: 'isolation', loadType: 'external',
    defaultIncrementKg: 2, defaultRepRange: [10, 15],
    cues: '手臂略微彎曲，舉到約與肩同高就停，不需要再往上。身體不要後仰晃動，下放時慢慢控制。',
  },
  {
    id: 'landmine-press', nameZh: '地雷管推舉', aliases: ['地雷推舉', 'Landmine Press', '單手斜推'], nameEn: 'Landmine Press',
    primary: ['frontDelt'], secondary: ['chest', 'triceps'], equipment: 'barbell', category: 'compound', loadType: 'external',
    defaultIncrementKg: 2.5, defaultRepRange: [8, 12],
    cues: '單手握住槓端，沿著槓子的弧線朝前上方推出，軀幹挺直不要側傾，每側各做完整組數。肩膀不舒服時，這個角度通常比垂直推舉友善。',
  },
  {
    id: 'kettlebell-press', nameZh: '壺鈴肩推', aliases: ['壺鈴推舉', '單手壺鈴肩推', 'Kettlebell Press'], nameEn: 'Kettlebell Overhead Press',
    primary: ['frontDelt'], secondary: ['triceps', 'sideDelt', 'abs'], equipment: 'kettlebell', category: 'compound', loadType: 'external',
    defaultIncrementKg: 4, defaultRepRange: [6, 10],
    cues: '壺鈴貼著前臂放在肩上（rack 位置），手腕保持中立，沿身體前方垂直推起。核心與臀部夾緊，避免腰往後折；每側各做完整組數。',
  },

  // 側三角
  {
    id: 'dumbbell-lateral-raise', nameZh: '啞鈴側平舉', aliases: ['側平舉', '啞鈴側舉', 'Lateral Raise'], nameEn: 'Dumbbell Lateral Raise',
    primary: ['sideDelt'], secondary: [], equipment: 'dumbbell', category: 'isolation', loadType: 'external',
    defaultIncrementKg: 2, defaultRepRange: [10, 15],
    cues: '手肘微彎，想著把手肘往兩側帶高而不是把啞鈴甩起來。舉到約與肩同高，頂端不聳肩，放下時慢慢控制。',
  },
  {
    id: 'cable-lateral-raise', nameZh: '滑輪側平舉', aliases: ['單臂滑輪側平舉', '繩索側平舉', 'Cable Lateral Raise'], nameEn: 'Cable Lateral Raise',
    primary: ['sideDelt'], secondary: [], equipment: 'cable', category: 'isolation', loadType: 'external',
    defaultIncrementKg: 2.5, defaultRepRange: [10, 15],
    cues: '滑輪設在低位，站在滑輪旁用遠側手臂拉，全程張力不間斷。手肘帶領動作、身體不要側倒借力，每側各做完整組數。',
  },
  {
    id: 'machine-lateral-raise', nameZh: '器械側平舉', aliases: ['側平舉機', '坐姿側平舉機', 'Lateral Raise Machine'], nameEn: 'Machine Lateral Raise',
    primary: ['sideDelt'], secondary: [], equipment: 'machine', category: 'isolation', loadType: 'external',
    defaultIncrementKg: 2.5, defaultRepRange: [10, 15],
    cues: '座椅調到肩關節對準機器旋轉軸，用手肘（而非手掌）去推墊子。頂端停一拍，下放不要讓配重碰在一起。',
  },
  {
    id: 'ez-bar-upright-row', nameZh: 'EZ 槓直立划船', aliases: ['直立划船', '槓鈴直立划船', 'Upright Row'], nameEn: 'EZ-Bar Upright Row',
    primary: ['sideDelt', 'upperBack'], secondary: ['frontDelt', 'biceps'], equipment: 'ezbar', category: 'compound', loadType: 'external',
    defaultIncrementKg: 2.5, defaultRepRange: [8, 12],
    cues: '握距略比肩寬，手肘領先手腕向上拉到胸口下緣，不必拉到下巴。若肩前側不舒服，就把握距放寬或改做側平舉。',
  },
  {
    id: 'band-lateral-raise', nameZh: '彈力帶側平舉', aliases: ['彈力帶側舉', 'Band Lateral Raise'], nameEn: 'Resistance Band Lateral Raise',
    primary: ['sideDelt'], secondary: [], equipment: 'band', category: 'isolation', loadType: 'external',
    defaultIncrementKg: 0, defaultRepRange: [10, 15],
    cues: '彈力帶踩在腳下，手肘微彎往兩側舉到肩高，頂端阻力最大，動作要慢、不要靠甩。阻力以換不同強度的彈力帶調整。',
  },

  // 後三角
  {
    id: 'face-pull', nameZh: '面拉', aliases: ['繩索面拉', '臉拉', 'Face Pull'], nameEn: 'Face Pull',
    primary: ['rearDelt', 'upperBack'], secondary: ['sideDelt'], equipment: 'cable', category: 'isolation', loadType: 'external',
    defaultIncrementKg: 2.5, defaultRepRange: [10, 15],
    cues: '滑輪設在約臉部高度，拉向額頭兩側並讓雙手往外打開，手肘維持高於手腕。頂端停一拍再放，重量輕一點、動作清楚比較重要。',
  },
  {
    id: 'reverse-pec-deck', nameZh: '反向蝴蝶機', aliases: ['蝴蝶機後三角', '後三角飛鳥機', '反向飛鳥機', 'Rear Delt Machine'], nameEn: 'Reverse Pec Deck',
    primary: ['rearDelt'], secondary: ['upperBack'], equipment: 'machine', category: 'isolation', loadType: 'external',
    defaultIncrementKg: 2.5, defaultRepRange: [10, 15],
    cues: '胸口貼緊胸墊，手臂略低於肩線，往兩側向後畫弧打開。聚焦在後肩而不是用力夾背，避免聳肩。',
  },
  {
    id: 'bent-over-dumbbell-reverse-fly', nameZh: '俯身啞鈴反向飛鳥', aliases: ['啞鈴後三角飛鳥', '俯身側平舉', '啞鈴反向飛鳥', 'Rear Delt Fly'], nameEn: 'Bent-Over Dumbbell Reverse Fly',
    primary: ['rearDelt'], secondary: ['upperBack', 'sideDelt'], equipment: 'dumbbell', category: 'isolation', loadType: 'external',
    defaultIncrementKg: 2, defaultRepRange: [10, 15],
    cues: '髖部後推、上身前傾接近水平，背保持平直。手肘微彎往兩側畫弧抬起，不要靠上身擺盪借力。',
  },
  {
    id: 'cable-rear-delt-fly', nameZh: '滑輪後三角飛鳥', aliases: ['滑輪反向飛鳥', '交叉滑輪後三角', 'Cable Reverse Fly'], nameEn: 'Cable Rear Delt Fly',
    primary: ['rearDelt'], secondary: ['upperBack'], equipment: 'cable', category: 'isolation', loadType: 'external',
    defaultIncrementKg: 2.5, defaultRepRange: [10, 15],
    cues: '兩側滑輪設在約肩高，左手拉右側、右手拉左側，手臂交叉後向兩側打開。保持軀幹穩定，動作由後肩帶動。',
  },
  {
    id: 'band-pull-apart', nameZh: '彈力帶拉開', aliases: ['彈力帶後拉', '彈力帶反向飛鳥', 'Band Pull-Apart'], nameEn: 'Band Pull-Apart',
    primary: ['rearDelt', 'upperBack'], secondary: [], equipment: 'band', category: 'isolation', loadType: 'external',
    defaultIncrementKg: 0, defaultRepRange: [12, 20],
    cues: '雙手與肩同寬握帶、手臂伸直舉到胸前，往兩側拉開到彈力帶碰到胸口。肩膀放鬆下沉，適合暖身或高次數收尾。',
  },

  // 背闊
  {
    id: 'lat-pulldown', nameZh: '滑輪下拉', aliases: ['高位下拉', '背闊肌下拉', '下拉', 'Lat Pulldown'], nameEn: 'Lat Pulldown',
    primary: ['lats'], secondary: ['biceps', 'upperBack', 'rearDelt'], equipment: 'cable', category: 'compound', loadType: 'external',
    defaultIncrementKg: 2.5, defaultRepRange: [8, 12],
    cues: '先讓肩胛下沉，再用手肘往下、往身體兩側拉，把橫桿帶到鎖骨上方。身體只微微後傾，回程讓手臂完整伸直，避免拉動時聳肩。',
  },
  {
    id: 'close-grip-lat-pulldown', nameZh: '窄握下拉', aliases: ['對握下拉', 'V 把下拉', '窄握滑輪下拉'], nameEn: 'Close-Grip Lat Pulldown',
    primary: ['lats'], secondary: ['biceps', 'upperBack'], equipment: 'cable', category: 'compound', loadType: 'external',
    defaultIncrementKg: 2.5, defaultRepRange: [8, 12],
    cues: '使用 V 把或對握把手，手肘貼近身體往下壓到胸口上方。感受背闊肌下側收縮，不要用手臂單獨拉。',
  },
  {
    id: 'single-arm-cable-pulldown', nameZh: '單臂滑輪下拉', aliases: ['單手下拉', '單臂高位下拉'], nameEn: 'Single-Arm Cable Pulldown',
    primary: ['lats'], secondary: ['biceps'], equipment: 'cable', category: 'compound', loadType: 'external',
    defaultIncrementKg: 2.5, defaultRepRange: [10, 15],
    cues: '單手握把，手肘往身體側邊拉下，同側肩膀先下沉再用力。可以微微轉動軀幹拉長背闊，每側各做完整組數。',
  },
  {
    id: 'straight-arm-pulldown', nameZh: '直臂下拉', aliases: ['直臂下壓', '直臂滑輪下拉', 'Straight-Arm Pulldown'], nameEn: 'Straight-Arm Pulldown',
    primary: ['lats'], secondary: ['triceps'], equipment: 'cable', category: 'isolation', loadType: 'external',
    defaultIncrementKg: 2.5, defaultRepRange: [10, 15],
    cues: '身體微微前傾，手臂保持近乎伸直，把繩索從頭前方畫弧壓到大腿旁。用背闊肌的力量下壓，不是用手臂硬壓。',
  },
  {
    id: 'pull-up', nameZh: '引體向上', aliases: ['寬握引體向上', 'Pull-up'], nameEn: 'Pull-Up',
    primary: ['lats'], secondary: ['biceps', 'upperBack', 'forearms'], equipment: 'bodyweight', category: 'compound', loadType: 'bodyweightPlus',
    defaultIncrementKg: 2.5, defaultRepRange: [6, 10],
    cues: '從完全伸直的懸垂開始，先把肩胛往下沉，再用手肘往下帶身體上去，下巴過槓。下放要控制到手臂完全伸直，不要靠擺盪借力。',
  },
  {
    id: 'chin-up', nameZh: '反手引體向上', aliases: ['反握引體向上', 'Chin-up', '反手引體'], nameEn: 'Chin-Up',
    primary: ['lats', 'biceps'], secondary: ['upperBack', 'forearms'], equipment: 'bodyweight', category: 'compound', loadType: 'bodyweightPlus',
    defaultIncrementKg: 2.5, defaultRepRange: [6, 10],
    cues: '反手與肩同寬握槓，胸口朝槓子方向靠近，比正握更常用到二頭。每次都從完整伸直開始，下放不要放任肘關節被快速拉直。',
  },
  {
    id: 'neutral-grip-pull-up', nameZh: '對握引體向上', aliases: ['窄握引體向上', 'Neutral-Grip Pull-up'], nameEn: 'Neutral-Grip Pull-Up',
    primary: ['lats'], secondary: ['biceps', 'upperBack'], equipment: 'bodyweight', category: 'compound', loadType: 'bodyweightPlus',
    defaultIncrementKg: 2.5, defaultRepRange: [6, 10],
    cues: '雙手掌心相對握住平行把手，對手肘與肩膀較友善。胸口向把手靠近，手肘往下拉向肋骨兩側。',
  },
  {
    id: 'assisted-pull-up', nameZh: '輔助引體向上', aliases: ['輔助引體機', '輔助引體', 'Assisted Pull-up'], nameEn: 'Assisted Pull-Up',
    primary: ['lats'], secondary: ['biceps', 'upperBack'], equipment: 'machine', category: 'compound', loadType: 'assisted',
    defaultIncrementKg: 2.5, defaultRepRange: [6, 10],
    cues: '配重越重輔助越多，進步的方向是逐步減少輔助重量。下放時手臂完全伸直並控制速度，拉的時候想著把手肘往下帶，不要靠膝蓋蹬踏板。',
  },
  {
    id: 'dumbbell-pullover', nameZh: '啞鈴仰臥拉舉', aliases: ['啞鈴過頭拉舉', '啞鈴直臂上拉', 'Dumbbell Pullover'], nameEn: 'Dumbbell Pullover',
    primary: ['lats'], secondary: ['chest', 'triceps'], equipment: 'dumbbell', category: 'isolation', loadType: 'external',
    defaultIncrementKg: 2, defaultRepRange: [10, 15],
    cues: '平躺或橫躺在臥椅上，雙手捧住一顆啞鈴，手肘微彎從胸口上方放到頭後方，感受背與胸側被拉長。拉回時用背闊肌收回，不要靠手臂屈伸。',
  },

  // 上背（划船、聳肩）
  {
    id: 'barbell-row', nameZh: '槓鈴划船', aliases: ['俯身槓鈴划船', '俯身划船', 'Bent-Over Row'], nameEn: 'Barbell Row',
    primary: ['lats', 'upperBack'], secondary: ['biceps', 'rearDelt', 'lowerBack'], equipment: 'barbell', category: 'compound', loadType: 'external',
    defaultIncrementKg: 2.5, defaultRepRange: [6, 10],
    cues: '髖部後推、上身前傾約 45 度，背保持平直不圓。用手肘把槓鈴拉向肚臍附近，下放時完整伸展，上身角度全程固定。',
  },
  {
    id: 'one-arm-dumbbell-row', nameZh: '單臂啞鈴划船', aliases: ['啞鈴單手划船', '單手划船', '啞鈴划船', 'One-Arm Row'], nameEn: 'One-Arm Dumbbell Row',
    primary: ['lats', 'upperBack'], secondary: ['biceps', 'rearDelt'], equipment: 'dumbbell', category: 'compound', loadType: 'external',
    defaultIncrementKg: 2, defaultRepRange: [8, 12],
    cues: '一手一膝撐在臥椅上，背與地面接近平行。手肘朝髖部方向拉，頂端肩胛收縮，下放讓背闊完整伸展，每側各做完整組數。',
  },
  {
    id: 'chest-supported-row', nameZh: '胸靠式划船', aliases: ['俯臥划船機', '胸墊划船', '胸托划船', 'Chest-Supported Row'], nameEn: 'Chest-Supported Row',
    primary: ['upperBack', 'lats'], secondary: ['biceps', 'rearDelt'], equipment: 'machine', category: 'compound', loadType: 'external',
    defaultIncrementKg: 2.5, defaultRepRange: [8, 12],
    cues: '胸口貼緊胸墊，下背不用出力，專心用肩胛和手肘把握把往後拉。頂端停一拍，下放時讓肩胛自然向前伸展。',
  },
  {
    id: 't-bar-row', nameZh: 'T 槓划船', aliases: ['T-Bar 划船', 'T 桿划船'], nameEn: 'T-Bar Row',
    primary: ['upperBack', 'lats'], secondary: ['biceps', 'rearDelt', 'lowerBack'], equipment: 'barbell', category: 'compound', loadType: 'external',
    defaultIncrementKg: 2.5, defaultRepRange: [8, 12],
    cues: '槓鈴一端固定在地雷座或牆角，雙腳跨站在槓兩側，髖部後推、背平直。把握把拉向胸口下方，下放時完整放鬆但不要圓背。',
  },
  {
    id: 'seated-cable-row', nameZh: '坐姿划船', aliases: ['滑輪坐姿划船', '坐姿滑輪划船', '低位划船', 'Seated Cable Row'], nameEn: 'Seated Cable Row',
    primary: ['lats', 'upperBack'], secondary: ['biceps', 'rearDelt'], equipment: 'cable', category: 'compound', loadType: 'external',
    defaultIncrementKg: 2.5, defaultRepRange: [8, 12],
    cues: '坐直、膝蓋微彎，把把手拉向肚臍附近，頂端肩胛夾緊。回程讓背部伸展但不要圓背彎腰，上身前後晃動幅度保持最小。',
  },
  {
    id: 'wide-grip-seated-cable-row', nameZh: '寬握坐姿划船', aliases: ['寬握滑輪划船', '上背滑輪划船'], nameEn: 'Wide-Grip Seated Cable Row',
    primary: ['upperBack'], secondary: ['lats', 'rearDelt', 'biceps'], equipment: 'cable', category: 'compound', loadType: 'external',
    defaultIncrementKg: 2.5, defaultRepRange: [8, 12],
    cues: '用寬握把手，手肘外展、拉向胸口下方，更偏上背與後肩。頂端夾緊肩胛，下放不要聳肩。',
  },
  {
    id: 'machine-row', nameZh: '器械划船', aliases: ['坐姿划船機', '划船機', 'Machine Row'], nameEn: 'Seated Machine Row',
    primary: ['upperBack', 'lats'], secondary: ['biceps', 'rearDelt'], equipment: 'machine', category: 'compound', loadType: 'external',
    defaultIncrementKg: 2.5, defaultRepRange: [8, 12],
    cues: '胸口輕靠胸墊，坐正後用手肘把握把往後帶，頂端肩胛內收。回程慢慢讓肩胛向前伸展，不要讓配重拉得身體晃動。',
  },
  {
    id: 'inverted-row', nameZh: '反向划船', aliases: ['低槓划船', '澳洲式引體', 'Inverted Row', 'Bodyweight Row'], nameEn: 'Inverted Row',
    primary: ['upperBack', 'lats'], secondary: ['biceps', 'rearDelt'], equipment: 'bodyweight', category: 'compound', loadType: 'bodyweight',
    defaultIncrementKg: 0, defaultRepRange: [8, 15],
    cues: '躺在史密斯機或低槓下方，身體像木板一樣挺直，把胸口拉向橫桿。腳越往前伸越難，臀部不要下垂。',
  },
  {
    id: 'barbell-shrug', nameZh: '槓鈴聳肩', aliases: ['槓鈴斜方肌聳肩', 'Barbell Shrug'], nameEn: 'Barbell Shrug',
    primary: ['upperBack'], secondary: ['forearms'], equipment: 'barbell', category: 'isolation', loadType: 'external',
    defaultIncrementKg: 2.5, defaultRepRange: [8, 12],
    cues: '手臂放鬆伸直，只用肩膀垂直向上聳，頂端停一拍再慢慢放下。不要繞肩或前後晃動頭，重量過重時握力先到極限可使用助握帶。',
  },
  {
    id: 'dumbbell-shrug', nameZh: '啞鈴聳肩', aliases: ['斜方肌聳肩', 'Dumbbell Shrug'], nameEn: 'Dumbbell Shrug',
    primary: ['upperBack'], secondary: ['forearms'], equipment: 'dumbbell', category: 'isolation', loadType: 'external',
    defaultIncrementKg: 2, defaultRepRange: [10, 15],
    cues: '雙手垂在身體兩側，肩膀垂直向耳朵方向聳起，頂端停一拍。全程手肘不要彎、頭不要前伸。',
  },

  // 二頭
  {
    id: 'ez-bar-curl', nameZh: 'EZ 槓彎舉', aliases: ['曲槓彎舉', 'EZ 槓二頭彎舉', '彎曲槓彎舉'], nameEn: 'EZ-Bar Curl',
    primary: ['biceps'], secondary: ['forearms'], equipment: 'ezbar', category: 'isolation', loadType: 'external',
    defaultIncrementKg: 2.5, defaultRepRange: [8, 12],
    cues: '手肘固定在身體兩側，不隨彎舉前後移動。頂端停一拍，放下時完整伸直手肘，身體不要借力往後仰。',
  },
  {
    id: 'barbell-curl', nameZh: '槓鈴彎舉', aliases: ['直槓彎舉', '槓鈴二頭彎舉', 'Barbell Curl'], nameEn: 'Barbell Curl',
    primary: ['biceps'], secondary: ['forearms'], equipment: 'barbell', category: 'isolation', loadType: 'external',
    defaultIncrementKg: 2.5, defaultRepRange: [8, 12],
    cues: '站穩、手肘貼近身體，用二頭把槓鈴弧線捲起，不要用腰與髖的反動力甩上來。放下要比舉起慢。',
  },
  {
    id: 'dumbbell-curl', nameZh: '啞鈴彎舉', aliases: ['啞鈴二頭彎舉', '交替彎舉', 'Dumbbell Curl'], nameEn: 'Dumbbell Curl',
    primary: ['biceps'], secondary: ['forearms'], equipment: 'dumbbell', category: 'isolation', loadType: 'external',
    defaultIncrementKg: 2, defaultRepRange: [8, 12],
    cues: '上舉時手掌慢慢轉向上方（旋後），手肘固定在身側。放下到手臂完全伸直，身體不要晃動借力。',
  },
  {
    id: 'hammer-curl', nameZh: '錘式彎舉', aliases: ['鎚式彎舉', '槌式彎舉', '啞鈴錘式彎舉', 'Hammer Curl'], nameEn: 'Hammer Curl',
    primary: ['biceps'], secondary: ['forearms'], equipment: 'dumbbell', category: 'isolation', loadType: 'external',
    defaultIncrementKg: 2, defaultRepRange: [8, 12],
    cues: '掌心相對，像握鎚子一樣垂直舉起，手腕保持中立。手肘固定不前移，能同時鍛鍊到肱肌與前臂。',
  },
  {
    id: 'incline-dumbbell-curl', nameZh: '上斜啞鈴彎舉', aliases: ['斜板啞鈴彎舉', '上斜彎舉', 'Incline Curl'], nameEn: 'Incline Dumbbell Curl',
    primary: ['biceps'], secondary: ['forearms'], equipment: 'dumbbell', category: 'isolation', loadType: 'external',
    defaultIncrementKg: 2, defaultRepRange: [8, 12],
    cues: '椅背約 45 至 60 度，手臂自然垂在身體後方，使二頭長頭在底部被拉長。肩膀貼緊椅背，用較輕重量、完整伸展。',
  },
  {
    id: 'ez-bar-preacher-curl', nameZh: 'EZ 槓牧師椅彎舉', aliases: ['牧師椅彎舉', '斜板彎舉', 'Preacher Curl', '傳道椅彎舉'], nameEn: 'EZ-Bar Preacher Curl',
    primary: ['biceps'], secondary: ['forearms'], equipment: 'ezbar', category: 'isolation', loadType: 'external',
    defaultIncrementKg: 2.5, defaultRepRange: [8, 12],
    cues: '腋下貼緊椅墊，上臂完整靠在斜板上，彎舉時不要離開墊子。底部不要放到被完全拉直而讓肘關節突然承重，下放要慢。',
  },
  {
    id: 'cable-curl', nameZh: '滑輪彎舉', aliases: ['繩索彎舉', '低位滑輪彎舉', 'Cable Curl'], nameEn: 'Cable Curl',
    primary: ['biceps'], secondary: ['forearms'], equipment: 'cable', category: 'isolation', loadType: 'external',
    defaultIncrementKg: 2.5, defaultRepRange: [10, 15],
    cues: '滑輪設在低位，手肘固定在身側，全程張力不鬆。頂端把二頭夾緊停一拍，離心階段慢慢放。',
  },
  {
    id: 'concentration-curl', nameZh: '集中彎舉', aliases: ['坐姿單臂彎舉', 'Concentration Curl'], nameEn: 'Concentration Curl',
    primary: ['biceps'], secondary: ['forearms'], equipment: 'dumbbell', category: 'isolation', loadType: 'external',
    defaultIncrementKg: 2, defaultRepRange: [10, 15],
    cues: '坐在臥椅邊緣，手肘抵在同側大腿內側作為固定點，只動前臂。頂端用力夾緊，慢慢放下，每側各做完整組數。',
  },
  {
    id: 'machine-biceps-curl', nameZh: '器械二頭彎舉', aliases: ['二頭肌彎舉機', '牧師椅彎舉機', 'Machine Curl'], nameEn: 'Machine Biceps Curl',
    primary: ['biceps'], secondary: ['forearms'], equipment: 'machine', category: 'isolation', loadType: 'external',
    defaultIncrementKg: 2.5, defaultRepRange: [10, 15],
    cues: '調整座椅讓腋下對準墊子上緣，上臂完整貼住。以手肘為軸彎舉到頂端夾緊，回程控制不要讓配重砸下。',
  },

  // 三頭
  {
    id: 'cable-triceps-pushdown', nameZh: '滑輪三頭下壓', aliases: ['三頭下壓', '直桿三頭下壓', '三頭肌下壓', 'Triceps Pushdown'], nameEn: 'Cable Triceps Pushdown',
    primary: ['triceps'], secondary: [], equipment: 'cable', category: 'isolation', loadType: 'external',
    defaultIncrementKg: 2.5, defaultRepRange: [10, 15],
    cues: '上臂夾緊身體兩側固定不動，只讓前臂下壓到手肘完全伸直，頂端擠壓一下再慢慢回。身體不要前壓用體重壓下去。',
  },
  {
    id: 'rope-triceps-pushdown', nameZh: '繩索三頭下壓', aliases: ['繩索下壓', 'Rope Pushdown'], nameEn: 'Rope Triceps Pushdown',
    primary: ['triceps'], secondary: [], equipment: 'cable', category: 'isolation', loadType: 'external',
    defaultIncrementKg: 2.5, defaultRepRange: [10, 15],
    cues: '下壓到底時把繩索往兩側撥開，額外增加三頭收縮。上臂固定在身側，回程慢慢放，不要讓手肘往前飄。',
  },
  {
    id: 'overhead-cable-triceps-extension', nameZh: '滑輪過頭三頭伸展', aliases: ['滑輪頸後臂屈伸', '過頭三頭伸展', '繩索過頭三頭', 'Overhead Triceps Extension'], nameEn: 'Overhead Cable Triceps Extension',
    primary: ['triceps'], secondary: [], equipment: 'cable', category: 'isolation', loadType: 'external',
    defaultIncrementKg: 2.5, defaultRepRange: [10, 15],
    cues: '背對滑輪、一腳在前站穩，雙手握繩從頭後方向前上方伸直。手肘指向前方並固定，過頭位置能讓三頭長頭得到更完整的伸展。',
  },
  {
    id: 'ez-bar-skull-crusher', nameZh: 'EZ 槓仰臥臂屈伸', aliases: ['仰臥三頭伸展', '碎顱者', 'Skull Crusher', '法式推舉'], nameEn: 'EZ-Bar Skull Crusher',
    primary: ['triceps'], secondary: [], equipment: 'ezbar', category: 'isolation', loadType: 'external',
    defaultIncrementKg: 2.5, defaultRepRange: [8, 12],
    cues: '平躺握住 EZ 槓，上臂略向頭後方傾斜，只讓手肘彎曲、把槓鈴放到額頭上方再伸直。手肘不要向外張開，重量從輕開始以保護手肘。',
  },
  {
    id: 'close-grip-bench-press', nameZh: '窄握臥推', aliases: ['窄距臥推', 'Close-Grip Bench Press'], nameEn: 'Close-Grip Bench Press',
    primary: ['triceps', 'chest'], secondary: ['frontDelt'], equipment: 'barbell', category: 'compound', loadType: 'external',
    defaultIncrementKg: 2.5, defaultRepRange: [6, 10],
    cues: '握距約與肩同寬或稍窄，不要窄到手腕被壓折。手肘貼近身體下放，推起時用三頭把槓鈴推直。',
  },
  {
    id: 'dumbbell-overhead-triceps-extension', nameZh: '啞鈴過頭三頭伸展', aliases: ['啞鈴頸後臂屈伸', '啞鈴頸後伸展'], nameEn: 'Dumbbell Overhead Triceps Extension',
    primary: ['triceps'], secondary: [], equipment: 'dumbbell', category: 'isolation', loadType: 'external',
    defaultIncrementKg: 2, defaultRepRange: [10, 15],
    cues: '雙手托住同一顆啞鈴舉到頭上，手肘朝前固定，讓啞鈴降到腦後再伸直。核心夾緊避免下背代償反折。',
  },
  {
    id: 'dumbbell-kickback', nameZh: '啞鈴三頭後踢', aliases: ['三頭後踢', '俯身臂屈伸', 'Triceps Kickback'], nameEn: 'Dumbbell Triceps Kickback',
    primary: ['triceps'], secondary: [], equipment: 'dumbbell', category: 'isolation', loadType: 'external',
    defaultIncrementKg: 2, defaultRepRange: [10, 15],
    cues: '上身前傾、上臂貼緊身體並與地面平行，只讓前臂向後伸直，頂端用力夾緊。重量輕，動作精準比重量重要，每側各做完整組數。',
  },
  {
    id: 'bench-dip', nameZh: '椅上撐體', aliases: ['椅子臂屈伸', '板凳撐體', '板凳臂屈伸', 'Bench Dip'], nameEn: 'Bench Dip',
    primary: ['triceps'], secondary: ['chest', 'frontDelt'], equipment: 'bodyweight', category: 'compound', loadType: 'bodyweight',
    defaultIncrementKg: 0, defaultRepRange: [10, 20],
    cues: '雙手在身後撐住板凳，臀部貼近椅邊上下移動。下放到上臂約與地面平行即可，太深會讓肩關節前側承受過大壓力。',
  },
  {
    id: 'diamond-push-up', nameZh: '鑽石伏地挺身', aliases: ['窄距伏地挺身', 'Diamond Push-up'], nameEn: 'Diamond Push-Up',
    primary: ['triceps', 'chest'], secondary: ['frontDelt'], equipment: 'bodyweight', category: 'compound', loadType: 'bodyweight',
    defaultIncrementKg: 0, defaultRepRange: [8, 15],
    cues: '雙手食指與拇指靠成菱形放在胸口下方，手肘朝後貼近身體。身體維持一直線，如果手腕不舒服可以把手距放寬一點。',
  },
  {
    id: 'machine-triceps-extension', nameZh: '器械三頭伸展', aliases: ['三頭肌伸展機', '坐姿三頭機', 'Triceps Extension Machine'], nameEn: 'Machine Triceps Extension',
    primary: ['triceps'], secondary: [], equipment: 'machine', category: 'isolation', loadType: 'external',
    defaultIncrementKg: 2.5, defaultRepRange: [10, 15],
    cues: '調整座椅讓手肘對準旋轉軸，上臂貼緊墊子。伸直到頂端夾緊三頭，回程控制不要讓配重帶著手臂亂甩。',
  },
  {
    id: 'band-triceps-pushdown', nameZh: '彈力帶三頭下壓', aliases: ['彈力帶下壓', 'Band Pushdown'], nameEn: 'Resistance Band Triceps Pushdown',
    primary: ['triceps'], secondary: [], equipment: 'band', category: 'isolation', loadType: 'external',
    defaultIncrementKg: 0, defaultRepRange: [12, 20],
    cues: '將彈力帶固定在高處（如單槓或門上方），上臂夾緊身側往下壓到手肘伸直。適合居家或沒有滑輪機時替代，阻力靠換帶子調整。',
  },

  // 前臂
  {
    id: 'barbell-wrist-curl', nameZh: '槓鈴腕彎舉', aliases: ['腕屈伸', '腕彎舉', '前臂彎舉', 'Wrist Curl'], nameEn: 'Barbell Wrist Curl',
    primary: ['forearms'], secondary: [], equipment: 'barbell', category: 'isolation', loadType: 'external',
    defaultIncrementKg: 2.5, defaultRepRange: [12, 20],
    cues: '前臂平放在大腿或臥椅上、掌心朝上，只動手腕把槓鈴捲起，底部讓槓鈴稍微滑到指尖再收回。重量用輕的、次數做足。',
  },
  {
    id: 'dumbbell-reverse-wrist-curl', nameZh: '啞鈴反握腕彎舉', aliases: ['反向腕彎舉', '腕伸展', 'Reverse Wrist Curl'], nameEn: 'Dumbbell Reverse Wrist Curl',
    primary: ['forearms'], secondary: [], equipment: 'dumbbell', category: 'isolation', loadType: 'external',
    defaultIncrementKg: 2, defaultRepRange: [12, 20],
    cues: '前臂放在大腿或臥椅上、掌心朝下，只動手腕往上抬起。這個動作很容易過重，使用輕啞鈴並慢慢放，每側各做完整組數。',
  },
  {
    id: 'ez-bar-reverse-curl', nameZh: 'EZ 槓反握彎舉', aliases: ['反握彎舉', '反向彎舉', 'Reverse Curl'], nameEn: 'EZ-Bar Reverse Curl',
    primary: ['forearms', 'biceps'], secondary: [], equipment: 'ezbar', category: 'isolation', loadType: 'external',
    defaultIncrementKg: 2.5, defaultRepRange: [10, 15],
    cues: '以反握（掌心朝下）握住 EZ 槓，手肘固定在身側彎舉。手腕保持中立不要往下折，重量要比一般彎舉輕。',
  },
  {
    id: 'farmer-walk', nameZh: '農夫走路', aliases: ['農夫行走', '農夫走', 'Farmer Walk', 'Farmer Carry'], nameEn: 'Farmer Walk',
    primary: ['forearms'], secondary: ['upperBack', 'abs', 'glutes'], equipment: 'dumbbell', category: 'compound', loadType: 'external',
    defaultIncrementKg: 2, defaultRepRange: [30, 60],
    cues: '次數欄位以「秒」計，每組走 30 至 60 秒。雙手各握一顆重啞鈴，挺胸、肩膀下沉、核心夾緊，用小步伐穩定行走，不要左右搖晃。',
  },
  {
    id: 'dead-hang', nameZh: '懸垂', aliases: ['單槓懸吊', '死懸', '懸吊', 'Dead Hang'], nameEn: 'Dead Hang',
    primary: ['forearms'], secondary: ['lats'], equipment: 'bodyweight', category: 'isolation', loadType: 'bodyweight',
    defaultIncrementKg: 0, defaultRepRange: [20, 45],
    cues: '次數欄位以「秒」計，每組撐 20 至 45 秒。雙手握單槓自然懸垂，肩膀保持微微下沉而不是整個人掛在關節上，握力不足可用助握帶。',
  },

  // 股四頭
  {
    id: 'barbell-back-squat', nameZh: '槓鈴深蹲', aliases: ['背槓深蹲', '深蹲', '後深蹲', 'Back Squat'], nameEn: 'Barbell Back Squat',
    primary: ['quads', 'glutes'], secondary: ['hamstrings', 'lowerBack', 'abs'], equipment: 'barbell', category: 'compound', loadType: 'external',
    defaultIncrementKg: 2.5, defaultRepRange: [5, 8],
    cues: '吸飽氣、核心繃緊，髖與膝同時彎曲下蹲，膝蓋沿腳尖方向。至少蹲到大腿接近水平，起身時髖與肩同步上升，背部全程保持中立。',
  },
  {
    id: 'barbell-front-squat', nameZh: '槓鈴前深蹲', aliases: ['前蹲', '前蹲舉', 'Front Squat'], nameEn: 'Barbell Front Squat',
    primary: ['quads'], secondary: ['glutes', 'abs', 'upperBack'], equipment: 'barbell', category: 'compound', loadType: 'external',
    defaultIncrementKg: 2.5, defaultRepRange: [5, 8],
    cues: '槓鈴架在前三角與鎖骨上，手肘抬高讓上臂接近與地面平行，這樣槓鈴才不會滑落。軀幹維持直立，蹲深不夠時先降低重量。',
  },
  {
    id: 'smith-machine-squat', nameZh: '史密斯深蹲', aliases: ['史密斯機深蹲', 'Smith Squat'], nameEn: 'Smith Machine Squat',
    primary: ['quads', 'glutes'], secondary: ['hamstrings', 'lowerBack'], equipment: 'smith', category: 'compound', loadType: 'external',
    defaultIncrementKg: 2.5, defaultRepRange: [6, 10],
    cues: '雙腳可略微前移，讓蹲下時膝蓋和腳踝角度舒服，核心繃緊。軌道固定不用顧平衡，但仍要控制下放速度，避免到底部彈起。',
  },
  {
    id: 'leg-press', nameZh: '腿推機', aliases: ['腿推', '45 度腿推機', '45度腿推機', 'Leg Press'], nameEn: 'Leg Press',
    primary: ['quads', 'glutes'], secondary: ['hamstrings'], equipment: 'machine', category: 'compound', loadType: 'external',
    defaultIncrementKg: 2.5, defaultRepRange: [8, 12],
    cues: '下背與臀部全程貼緊椅墊，下放到膝蓋接近胸口但骨盆不離墊。推起時膝蓋沿腳尖方向，頂端不要把膝蓋完全鎖死。',
  },
  {
    id: 'leg-extension', nameZh: '腿伸展機', aliases: ['腿伸展', '大腿伸展機', '坐姿腿伸展', 'Leg Extension'], nameEn: 'Leg Extension',
    primary: ['quads'], secondary: [], equipment: 'machine', category: 'isolation', loadType: 'external',
    defaultIncrementKg: 2.5, defaultRepRange: [10, 15],
    cues: '調整靠墊讓膝蓋對準機器轉軸，背貼緊椅背。伸直到頂端夾緊股四頭停一拍，放下時慢慢控制，不要用甩的。',
  },
  {
    id: 'hack-squat', nameZh: '哈克深蹲', aliases: ['哈克深蹲機', 'Hack Squat'], nameEn: 'Hack Squat',
    primary: ['quads'], secondary: ['glutes'], equipment: 'machine', category: 'compound', loadType: 'external',
    defaultIncrementKg: 2.5, defaultRepRange: [8, 12],
    cues: '背與臀貼緊靠墊，腳掌放在踏板中間偏上、與肩同寬，膝蓋沿腳尖方向。下蹲到大腿與地面平行或更低，起身時用腳掌整個踩穩。',
  },
  {
    id: 'goblet-squat', nameZh: '高腳杯深蹲', aliases: ['啞鈴高腳杯深蹲', '酒杯式深蹲', 'Goblet Squat'], nameEn: 'Goblet Squat',
    primary: ['quads', 'glutes'], secondary: ['abs'], equipment: 'dumbbell', category: 'compound', loadType: 'external',
    defaultIncrementKg: 2, defaultRepRange: [8, 12],
    cues: '雙手在胸前抱住一顆啞鈴，手肘夾在膝蓋內側，軀幹保持直立往下蹲。重量放在胸前能自然幫助維持直立姿勢，適合學習深蹲。',
  },
  {
    id: 'dumbbell-walking-lunge', nameZh: '啞鈴行走弓箭步', aliases: ['行走弓箭步', '啞鈴弓箭步', '走路弓箭步', 'Walking Lunge'], nameEn: 'Dumbbell Walking Lunge',
    primary: ['quads', 'glutes'], secondary: ['hamstrings'], equipment: 'dumbbell', category: 'compound', loadType: 'external',
    defaultIncrementKg: 2, defaultRepRange: [8, 12],
    cues: '每一步跨出足夠長，前腳踩穩，後膝下降到接近地面，軀幹保持直立。次數以每腿計，前膝不要內夾。',
  },
  {
    id: 'dumbbell-reverse-lunge', nameZh: '啞鈴後跨步蹲', aliases: ['後跨步蹲', '反向弓箭步', 'Reverse Lunge'], nameEn: 'Dumbbell Reverse Lunge',
    primary: ['glutes', 'quads'], secondary: ['hamstrings'], equipment: 'dumbbell', category: 'compound', loadType: 'external',
    defaultIncrementKg: 2, defaultRepRange: [8, 12],
    cues: '一腳向後退一大步，前腳全腳掌踩穩，用前腳的力量站回起點。比向前的弓箭步對膝蓋更友善，次數以每腿計。',
  },
  {
    id: 'bulgarian-split-squat', nameZh: '保加利亞分腿蹲', aliases: ['保加利亞蹲', '後腳抬高分腿蹲', 'Bulgarian Split Squat'], nameEn: 'Bulgarian Split Squat',
    primary: ['quads', 'glutes'], secondary: ['hamstrings'], equipment: 'dumbbell', category: 'compound', loadType: 'external',
    defaultIncrementKg: 2, defaultRepRange: [8, 12],
    cues: '後腳腳背放在臥椅上，前腳站得夠遠，下蹲時前腳膝蓋不要過度超過腳尖。上身略前傾偏臀、直立偏股四頭，次數以每腿計。',
  },
  {
    id: 'dumbbell-step-up', nameZh: '啞鈴登階', aliases: ['登階', '踏階', 'Step-up'], nameEn: 'Dumbbell Step-Up',
    primary: ['quads', 'glutes'], secondary: ['hamstrings', 'calves'], equipment: 'dumbbell', category: 'compound', loadType: 'external',
    defaultIncrementKg: 2, defaultRepRange: [8, 12],
    cues: '選擇高度約到膝蓋的箱子，整個前腳掌踩穩，只用前腳出力站起，不要靠後腳蹬地。下階時慢慢控制，次數以每腿計。',
  },
  {
    id: 'bodyweight-squat', nameZh: '徒手深蹲', aliases: ['自重深蹲', '徒手蹲', 'Bodyweight Squat'], nameEn: 'Bodyweight Squat',
    primary: ['quads', 'glutes'], secondary: ['hamstrings'], equipment: 'bodyweight', category: 'compound', loadType: 'bodyweight',
    defaultIncrementKg: 0, defaultRepRange: [12, 20],
    cues: '雙腳與肩同寬略外開，胸口挺起、重心壓在整個腳掌，往下坐到大腿與地面平行以下。適合暖身、居家訓練，或剛開始學習深蹲動作。',
  },
  {
    id: 'trap-bar-deadlift', nameZh: '六角槓硬舉', aliases: ['六角槓', 'Trap Bar Deadlift', 'Hex Bar Deadlift'], nameEn: 'Trap Bar Deadlift',
    primary: ['quads', 'glutes'], secondary: ['hamstrings', 'lowerBack', 'upperBack'], equipment: 'barbell', category: 'compound', loadType: 'external',
    defaultIncrementKg: 5, defaultRepRange: [5, 8],
    cues: '站在六角槓中間，握住側邊把手，把地板往下踩、挺胸讓背保持平直。比直槓硬舉更偏向腿部推起，起身時髖與膝同步伸直。',
  },

  // 腿後
  {
    id: 'romanian-deadlift', nameZh: '羅馬尼亞硬舉', aliases: ['RDL', '羅馬尼亞式硬舉', '槓鈴羅馬尼亞硬舉', 'Romanian Deadlift'], nameEn: 'Romanian Deadlift',
    primary: ['hamstrings', 'glutes'], secondary: ['lowerBack', 'upperBack', 'forearms'], equipment: 'barbell', category: 'compound', loadType: 'external',
    defaultIncrementKg: 5, defaultRepRange: [6, 10],
    cues: '膝蓋微彎並固定，髖部往後推，槓鈴貼著大腿滑到小腿中段。背保持中立，腿後側有明顯拉伸就用臀部把身體推回站直。',
  },
  {
    id: 'dumbbell-romanian-deadlift', nameZh: '啞鈴羅馬尼亞硬舉', aliases: ['啞鈴 RDL', 'Dumbbell RDL'], nameEn: 'Dumbbell Romanian Deadlift',
    primary: ['hamstrings', 'glutes'], secondary: ['lowerBack', 'forearms'], equipment: 'dumbbell', category: 'compound', loadType: 'external',
    defaultIncrementKg: 2, defaultRepRange: [8, 12],
    cues: '啞鈴貼著大腿前側下放，髖部往後推，膝蓋微彎不動。感受腿後側拉長後，用臀部發力站起，背部不要圓。',
  },
  {
    id: 'stiff-leg-deadlift', nameZh: '直腿硬舉', aliases: ['僵直腿硬舉', 'Stiff-Leg Deadlift'], nameEn: 'Stiff-Leg Deadlift',
    primary: ['hamstrings'], secondary: ['glutes', 'lowerBack'], equipment: 'barbell', category: 'compound', loadType: 'external',
    defaultIncrementKg: 5, defaultRepRange: [8, 12],
    cues: '膝蓋彎曲角度比羅馬尼亞硬舉更小、接近伸直，槓鈴可以放得更低。柔軟度不夠時不要硬追求深度，背部一旦圓起就停止下放。',
  },
  {
    id: 'single-leg-dumbbell-rdl', nameZh: '啞鈴單腿羅馬尼亞硬舉', aliases: ['單腿 RDL', '單腿硬舉', 'Single-Leg RDL'], nameEn: 'Single-Leg Dumbbell Romanian Deadlift',
    primary: ['hamstrings', 'glutes'], secondary: ['lowerBack'], equipment: 'dumbbell', category: 'compound', loadType: 'external',
    defaultIncrementKg: 2, defaultRepRange: [8, 12],
    cues: '單腳站立，另一腳往後延伸，上身與後腳成一直線往前傾。骨盆保持水平不打開，需要時可扶住東西穩住平衡，次數以每腿計。',
  },
  {
    id: 'lying-leg-curl', nameZh: '俯臥腿彎舉', aliases: ['趴姿腿彎舉', '腿彎舉', '俯臥腿屈伸', 'Lying Leg Curl'], nameEn: 'Lying Leg Curl',
    primary: ['hamstrings'], secondary: ['calves'], equipment: 'machine', category: 'isolation', loadType: 'external',
    defaultIncrementKg: 2.5, defaultRepRange: [10, 15],
    cues: '趴好後髖部壓住墊子不要翹臀，膝蓋對準機器轉軸。把小腿捲向臀部，頂端停一拍，放下時慢慢伸直，不要讓配重彈回。',
  },
  {
    id: 'seated-leg-curl', nameZh: '坐姿腿彎舉', aliases: ['坐姿腿屈伸', 'Seated Leg Curl'], nameEn: 'Seated Leg Curl',
    primary: ['hamstrings'], secondary: ['calves'], equipment: 'machine', category: 'isolation', loadType: 'external',
    defaultIncrementKg: 2.5, defaultRepRange: [10, 15],
    cues: '大腿壓墊固定，靠背貼緊，小腿往下、往後彎曲。坐姿讓髖處於屈曲位，腿後側在伸展位被拉得更長，下放時完整控制。',
  },
  {
    id: 'nordic-curl', nameZh: '北歐腿彎舉', aliases: ['北歐式腿彎舉', 'Nordic Hamstring Curl'], nameEn: 'Nordic Hamstring Curl',
    primary: ['hamstrings'], secondary: ['glutes'], equipment: 'bodyweight', category: 'isolation', loadType: 'bodyweight',
    defaultIncrementKg: 0, defaultRepRange: [5, 10],
    cues: '跪在墊子上，腳踝被固定住，身體保持從膝蓋到頭一直線，慢慢往前倒。用腿後側盡量控制下降速度，撐不住時用雙手接地，再用手輔助推回。',
  },

  // 臀
  {
    id: 'barbell-hip-thrust', nameZh: '槓鈴臀推', aliases: ['臀推', '槓鈴臀橋', 'Hip Thrust'], nameEn: 'Barbell Hip Thrust',
    primary: ['glutes'], secondary: ['hamstrings', 'quads'], equipment: 'barbell', category: 'compound', loadType: 'external',
    defaultIncrementKg: 2.5, defaultRepRange: [6, 10],
    cues: '上背靠在臥椅邊緣，槓鈴（加護墊）放在髖骨上方，下巴微收。頂端臀部夾緊、肋骨不外翻，小腿接近垂直地面。',
  },
  {
    id: 'glute-bridge', nameZh: '臀橋', aliases: ['徒手臀橋', '仰臥臀橋', 'Glute Bridge'], nameEn: 'Glute Bridge',
    primary: ['glutes'], secondary: ['hamstrings'], equipment: 'bodyweight', category: 'compound', loadType: 'bodyweight',
    defaultIncrementKg: 0, defaultRepRange: [12, 20],
    cues: '仰躺屈膝，腳掌踩穩，用臀部把髖抬高到肩膀、髖、膝成一直線。頂端夾緊停兩秒，不要用下背過度反折來假裝抬高。',
  },
  {
    id: 'band-glute-bridge', nameZh: '彈力帶臀橋', aliases: ['彈力帶臀推', 'Banded Glute Bridge'], nameEn: 'Banded Glute Bridge',
    primary: ['glutes'], secondary: ['hamstrings'], equipment: 'band', category: 'isolation', loadType: 'external',
    defaultIncrementKg: 0, defaultRepRange: [12, 20],
    cues: '彈力帶套在膝蓋上方，抬髖時刻意把膝蓋往外推抵抗彈力帶。這能同時活化臀中肌，頂端停兩秒再放下。',
  },
  {
    id: 'cable-kickback', nameZh: '滑輪後踢', aliases: ['繩索後踢', '滑輪臀部後踢', '腳踝滑輪後踢', 'Cable Glute Kickback'], nameEn: 'Cable Glute Kickback',
    primary: ['glutes'], secondary: ['hamstrings'], equipment: 'cable', category: 'isolation', loadType: 'external',
    defaultIncrementKg: 2.5, defaultRepRange: [10, 15],
    cues: '腳踝繫上腳套，扶住機器、上身略前傾，用臀部把腿往後上方踢出。骨盆保持穩定，不要靠下背反折，每側各做完整組數。',
  },
  {
    id: 'hip-abduction-machine', nameZh: '髖外展機', aliases: ['外展機', '大腿外展機', '坐姿外開腿', 'Hip Abduction'], nameEn: 'Hip Abduction Machine',
    primary: ['glutes'], secondary: [], equipment: 'machine', category: 'isolation', loadType: 'external',
    defaultIncrementKg: 2.5, defaultRepRange: [12, 20],
    cues: '背貼椅背，身體略往前傾能更偏重臀部。往外打開到最大幅度停一拍，回程慢慢控制，不要讓配重撞擊。',
  },
  {
    id: 'band-lateral-walk', nameZh: '彈力帶側向行走', aliases: ['彈力帶螃蟹步', '螃蟹步', '側走', 'Banded Lateral Walk', 'Monster Walk'], nameEn: 'Banded Lateral Walk',
    primary: ['glutes'], secondary: [], equipment: 'band', category: 'isolation', loadType: 'external',
    defaultIncrementKg: 0, defaultRepRange: [12, 20],
    cues: '彈力帶套在膝蓋上方或腳踝，微蹲姿勢維持，向側邊走一步後再慢慢併腳。全程保持彈力帶緊繃，膝蓋不要內夾，次數以每個方向的步數計。',
  },
  {
    id: 'sumo-deadlift', nameZh: '相撲硬舉', aliases: ['相撲式硬舉', 'Sumo Deadlift'], nameEn: 'Sumo Deadlift',
    primary: ['glutes', 'quads'], secondary: ['hamstrings', 'lowerBack', 'upperBack'], equipment: 'barbell', category: 'compound', loadType: 'external',
    defaultIncrementKg: 5, defaultRepRange: [5, 8],
    cues: '雙腳寬站、腳尖外開，膝蓋沿腳尖方向外推，上身比傳統硬舉更直立。起槓時把地板往外推開，不要讓槓鈴離身體太遠。',
  },
  {
    id: 'kettlebell-swing', nameZh: '壺鈴擺盪', aliases: ['壺鈴甩動', '壺鈴擺動', 'Kettlebell Swing'], nameEn: 'Kettlebell Swing',
    primary: ['glutes', 'hamstrings'], secondary: ['lowerBack', 'abs'], equipment: 'kettlebell', category: 'compound', loadType: 'external',
    defaultIncrementKg: 4, defaultRepRange: [10, 20],
    cues: '以髖鉸鏈爆發式伸髖，把壺鈴送到約胸口高度，手臂只是連接線，不用手往上抬。重量來自臀的推送，頂端站直、不要往後仰。',
  },

  // 小腿
  {
    id: 'standing-calf-raise', nameZh: '站姿提踵', aliases: ['站姿小腿提踵', '提踵機', 'Standing Calf Raise'], nameEn: 'Standing Calf Raise',
    primary: ['calves'], secondary: [], equipment: 'machine', category: 'isolation', loadType: 'external',
    defaultIncrementKg: 2.5, defaultRepRange: [10, 20],
    cues: '前腳掌踩在踏板邊緣，下放到小腿有明顯拉伸，再盡量踮到最高並停一拍。膝蓋保持伸直、動作慢而完整，不要彈跳。',
  },
  {
    id: 'seated-calf-raise', nameZh: '坐姿提踵', aliases: ['坐姿小腿提踵', 'Seated Calf Raise'], nameEn: 'Seated Calf Raise',
    primary: ['calves'], secondary: [], equipment: 'machine', category: 'isolation', loadType: 'external',
    defaultIncrementKg: 2.5, defaultRepRange: [10, 20],
    cues: '膝蓋彎曲時重點在比目魚肌。底部充分拉伸，頂端用力踮高停一拍，次數可以偏高。',
  },
  {
    id: 'leg-press-calf-raise', nameZh: '腿推機提踵', aliases: ['腿推提踵', 'Leg Press Calf Raise'], nameEn: 'Leg Press Calf Raise',
    primary: ['calves'], secondary: [], equipment: 'machine', category: 'isolation', loadType: 'external',
    defaultIncrementKg: 2.5, defaultRepRange: [10, 20],
    cues: '坐在腿推機上、前腳掌踩在踏板下緣，膝蓋保持幾乎伸直，只用腳踝推動踏板。離開前務必先把安全卡榫放好。',
  },
  {
    id: 'smith-machine-calf-raise', nameZh: '史密斯提踵', aliases: ['史密斯機提踵', 'Smith Calf Raise'], nameEn: 'Smith Machine Calf Raise',
    primary: ['calves'], secondary: [], equipment: 'smith', category: 'isolation', loadType: 'external',
    defaultIncrementKg: 2.5, defaultRepRange: [10, 20],
    cues: '前腳掌踩在槓鈴下方的踏板或槓片上增加活動範圍，身體直立槓鈴扛在肩上。底部充分拉伸、頂端踮到最高，節奏穩定不要彈跳。',
  },
  {
    id: 'single-leg-dumbbell-calf-raise', nameZh: '啞鈴單腿提踵', aliases: ['單腿提踵', '啞鈴提踵', 'Single-Leg Calf Raise'], nameEn: 'Single-Leg Dumbbell Calf Raise',
    primary: ['calves'], secondary: [], equipment: 'dumbbell', category: 'isolation', loadType: 'external',
    defaultIncrementKg: 2, defaultRepRange: [10, 20],
    cues: '單腳踩在階梯邊緣，同側手握啞鈴、另一手扶牆保持平衡。下放到最低、踮到最高，每側各做完整組數。',
  },

  // 腹
  {
    id: 'plank', nameZh: '平板支撐', aliases: ['棒式', '平板式', 'Plank'], nameEn: 'Plank',
    primary: ['abs'], secondary: ['glutes', 'frontDelt'], equipment: 'bodyweight', category: 'isolation', loadType: 'bodyweight',
    defaultIncrementKg: 0, defaultRepRange: [30, 60],
    cues: '次數欄位以「秒」計，每組撐 30 至 60 秒。手肘在肩膀正下方，從頭到腳成一直線，收肋骨、夾臀，不要塌腰或翹臀。',
  },
  {
    id: 'side-plank', nameZh: '側平板支撐', aliases: ['側棒式', '側橋', 'Side Plank'], nameEn: 'Side Plank',
    primary: ['abs'], secondary: ['glutes'], equipment: 'bodyweight', category: 'isolation', loadType: 'bodyweight',
    defaultIncrementKg: 0, defaultRepRange: [20, 45],
    cues: '次數欄位以「秒」計，每側撐 20 至 45 秒。手肘撐在肩膀正下方，髖部抬高讓身體成一直線，不要往前或往後倒。',
  },
  {
    id: 'hanging-leg-raise', nameZh: '懸垂抬腿', aliases: ['懸垂舉腿', '吊單槓抬腿', 'Hanging Leg Raise'], nameEn: 'Hanging Leg Raise',
    primary: ['abs'], secondary: ['forearms'], equipment: 'bodyweight', category: 'isolation', loadType: 'bodyweight',
    defaultIncrementKg: 0, defaultRepRange: [10, 20],
    cues: '雙手握單槓懸垂，先收肋骨把骨盆捲起來再抬腿，這樣才練到腹肌而不是只用髖屈肌。下放時慢慢控制，避免身體前後擺盪。',
  },
  {
    id: 'hanging-knee-raise', nameZh: '懸垂抬膝', aliases: ['吊單槓抬膝', 'Hanging Knee Raise'], nameEn: 'Hanging Knee Raise',
    primary: ['abs'], secondary: ['forearms'], equipment: 'bodyweight', category: 'isolation', loadType: 'bodyweight',
    defaultIncrementKg: 0, defaultRepRange: [10, 20],
    cues: '抬膝版本比直腿抬腿容易，是進階前的好過渡。刻意把骨盆往上捲，膝蓋盡量舉到胸口，下放不要晃盪。',
  },
  {
    id: 'cable-crunch', nameZh: '滑輪捲腹', aliases: ['跪姿滑輪捲腹', '繩索捲腹', 'Cable Crunch'], nameEn: 'Cable Crunch',
    primary: ['abs'], secondary: [], equipment: 'cable', category: 'isolation', loadType: 'external',
    defaultIncrementKg: 2.5, defaultRepRange: [10, 20],
    cues: '跪在滑輪下方，雙手抓繩固定在額頭兩側，髖部位置不動，用腹肌把胸口捲向骨盆。不要用手臂往下拉或靠髖部前後晃動。',
  },
  {
    id: 'crunch', nameZh: '捲腹', aliases: ['仰臥捲腹', '腹肌捲腹', 'Crunch'], nameEn: 'Crunch',
    primary: ['abs'], secondary: [], equipment: 'bodyweight', category: 'isolation', loadType: 'bodyweight',
    defaultIncrementKg: 0, defaultRepRange: [10, 20],
    cues: '仰躺屈膝，雙手放在耳旁或胸前，只讓上背離開地面，下巴與胸口保持一拳距離。下背貼地，動作慢而有控制，不要用手拉頭。',
  },
  {
    id: 'ab-wheel-rollout', nameZh: '腹輪滾動', aliases: ['健腹輪', '腹肌滾輪', '腹輪', 'Ab Wheel Rollout'], nameEn: 'Ab Wheel Rollout',
    primary: ['abs'], secondary: ['lats', 'frontDelt'], equipment: 'other', category: 'compound', loadType: 'bodyweight',
    defaultIncrementKg: 0, defaultRepRange: [8, 15],
    cues: '跪姿握住腹輪，骨盆微微後捲，向前滾出到身體伸長但腰不塌陷為止。用腹肌與背闊把身體拉回，一開始先縮小滾動幅度。',
  },
  {
    id: 'machine-crunch', nameZh: '腹肌捲腹機', aliases: ['器械捲腹', '坐姿腹肌機', '腹肌機', 'Ab Crunch Machine'], nameEn: 'Machine Ab Crunch',
    primary: ['abs'], secondary: [], equipment: 'machine', category: 'isolation', loadType: 'external',
    defaultIncrementKg: 2.5, defaultRepRange: [10, 20],
    cues: '調好座椅讓機器的轉軸約在肚臍高度，用腹肌把上身向下捲，而不是用手或髖屈肌推。回程慢慢放，保持腹部張力。',
  },
  {
    id: 'decline-sit-up', nameZh: '斜板仰臥起坐', aliases: ['斜板起坐', 'Decline Sit-up'], nameEn: 'Decline Sit-Up',
    primary: ['abs'], secondary: ['quads'], equipment: 'bodyweight', category: 'isolation', loadType: 'bodyweight',
    defaultIncrementKg: 0, defaultRepRange: [10, 20],
    cues: '腳固定在斜板上，起身時由腹部先捲起再帶動上身，不要甩頭靠慣性。下放時慢慢控制，下背有不適就改用捲腹。',
  },
  {
    id: 'russian-twist', nameZh: '俄羅斯轉體', aliases: ['坐姿轉體', 'Russian Twist'], nameEn: 'Russian Twist',
    primary: ['abs'], secondary: [], equipment: 'bodyweight', category: 'isolation', loadType: 'bodyweight',
    defaultIncrementKg: 0, defaultRepRange: [10, 20],
    cues: '坐姿上身後傾約 45 度，背保持直，轉動肋骨與胸腔而不是只甩手。次數以兩側各一次為一下，腳可離地增加難度。',
  },
  {
    id: 'pallof-press', nameZh: '帕洛夫推', aliases: ['Pallof Press', '抗旋轉推', '滑輪抗旋轉'], nameEn: 'Pallof Press',
    primary: ['abs'], secondary: [], equipment: 'cable', category: 'isolation', loadType: 'external',
    defaultIncrementKg: 2.5, defaultRepRange: [10, 15],
    cues: '側身站在滑輪旁，雙手握把手在胸前，向前推直再收回，全程身體不被滑輪拉得轉動。這是抗旋轉的核心訓練，每側各做完整組數。',
  },

  // 下背
  {
    id: 'back-extension', nameZh: '羅馬椅背伸展', aliases: ['背伸展', '羅馬椅挺身', '山羊挺身', 'Back Extension', 'Hyperextension'], nameEn: 'Back Extension',
    primary: ['lowerBack'], secondary: ['glutes', 'hamstrings'], equipment: 'machine', category: 'compound', loadType: 'bodyweightPlus',
    defaultIncrementKg: 2.5, defaultRepRange: [10, 15],
    cues: '髖部放在墊子上緣，身體以髖為軸前彎再抬起，頂端身體成一直線即可，不要過度仰頭反折。可抱啞鈴片在胸前增加負荷。',
  },
  {
    id: 'machine-back-extension', nameZh: '坐姿背伸展機', aliases: ['背伸展機', '下背伸展機', 'Machine Back Extension'], nameEn: 'Machine Back Extension',
    primary: ['lowerBack'], secondary: ['glutes'], equipment: 'machine', category: 'isolation', loadType: 'external',
    defaultIncrementKg: 2.5, defaultRepRange: [10, 15],
    cues: '調整座位讓髖部對準機器轉軸，雙腳固定、背靠在背墊上。用下背把身體往後推到中立位置即可，不要為了加重而過度後仰。',
  },
  {
    id: 'reverse-hyperextension', nameZh: '反向背伸展', aliases: ['反向挺身', '反向山羊挺身', 'Reverse Hyperextension'], nameEn: 'Reverse Hyperextension',
    primary: ['glutes', 'lowerBack'], secondary: ['hamstrings'], equipment: 'machine', category: 'isolation', loadType: 'external',
    defaultIncrementKg: 2.5, defaultRepRange: [10, 15],
    cues: '上身趴在墊子上、雙手抓緊握把，用臀部與下背把雙腿向後上方抬到與身體成一直線。腿不要甩得過高，下放時控制速度。',
  },
  {
    id: 'good-morning', nameZh: '早安體前屈', aliases: ['早安運動', '槓鈴早安', 'Good Morning'], nameEn: 'Good Morning',
    primary: ['lowerBack', 'hamstrings'], secondary: ['glutes'], equipment: 'barbell', category: 'compound', loadType: 'external',
    defaultIncrementKg: 2.5, defaultRepRange: [8, 12],
    cues: '槓鈴扛在肩上，膝蓋微彎，髖部往後推讓上身前傾，背部全程保持中立。重量要從輕開始，感受腿後側拉長後再用臀部推回站直。',
  },
  {
    id: 'rack-pull', nameZh: '架上硬舉', aliases: ['半程硬舉', '槓鈴架上拉', 'Rack Pull'], nameEn: 'Rack Pull',
    primary: ['lowerBack', 'upperBack'], secondary: ['glutes', 'hamstrings', 'forearms'], equipment: 'barbell', category: 'compound', loadType: 'external',
    defaultIncrementKg: 5, defaultRepRange: [5, 8],
    cues: '把槓鈴放在安全架上約膝蓋高度，以硬舉姿勢拉起。縮短了起始行程，可使用較重重量練背部與握力，挺胸、肩胛後收，不要圓背。',
  },
  {
    id: 'barbell-deadlift', nameZh: '槓鈴硬舉', aliases: ['硬舉', '傳統硬舉', 'Deadlift'], nameEn: 'Barbell Deadlift',
    primary: ['glutes', 'hamstrings'], secondary: ['lowerBack', 'upperBack', 'forearms'], equipment: 'barbell', category: 'compound', loadType: 'external',
    defaultIncrementKg: 5, defaultRepRange: [5, 8],
    cues: '槓鈴貼近小腿，髖部略高於膝蓋，肩胛下沉、背保持中立，把地板往下踩而不是用背拉。站直時臀部夾緊就好，不要過度後仰。',
  },
  {
    id: 'superman', nameZh: '超人式', aliases: ['背部超人式', '趴姿背伸', 'Superman'], nameEn: 'Superman',
    primary: ['lowerBack'], secondary: ['glutes'], equipment: 'bodyweight', category: 'isolation', loadType: 'bodyweight',
    defaultIncrementKg: 0, defaultRepRange: [10, 20],
    cues: '趴姿雙手前伸，同時抬起手臂與雙腿，頂端用下背與臀部夾緊停一拍。視線朝下、頸部保持中立，不用抬得太高。',
  },
];
