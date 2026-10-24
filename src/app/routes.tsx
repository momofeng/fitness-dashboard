import { createHashRouter } from 'react-router';
import { AppShell } from './AppShell';
import { RootGate } from './RootGate';
import { RouteError } from './RouteError';

type Mod = { default: React.ComponentType };
const page = (load: () => Promise<Mod>) => async () => ({ Component: (await load()).default });

// GitHub Pages 沒有 SPA 轉址，用 hash 路由；每頁延遲載入，首次載入只帶外框與首頁
export const router = createHashRouter([
  {
    element: <RootGate />,
    errorElement: <RouteError />,
    children: [
      { path: 'onboarding', lazy: page(() => import('../features/onboarding/Onboarding')) },
      { path: 'train/session/:id', lazy: page(() => import('../features/workout/LiveWorkout')) },
      {
        element: <AppShell />,
        children: [
          { index: true, lazy: page(() => import('../features/dashboard/Dashboard')) },
          { path: 'train', lazy: page(() => import('../features/workout/TrainHome')) },
          { path: 'train/history', lazy: page(() => import('../features/workout/History')) },
          { path: 'train/history/:id', lazy: page(() => import('../features/workout/WorkoutDetail')) },
          { path: 'train/program', lazy: page(() => import('../features/workout/ProgramPage')) },
          { path: 'train/exercises', lazy: page(() => import('../features/workout/ExerciseLibrary')) },
          { path: 'train/exercise/:id', lazy: page(() => import('../features/workout/ExerciseDetail')) },
          { path: 'train/cardio', lazy: page(() => import('../features/workout/CardioPage')) },
          { path: 'eat', lazy: page(() => import('../features/nutrition/NutritionDay')) },
          { path: 'eat/add', lazy: page(() => import('../features/nutrition/AddFood')) },
          { path: 'eat/foods', lazy: page(() => import('../features/nutrition/MyFoods')) },
          { path: 'eat/week', lazy: page(() => import('../features/nutrition/NutritionWeek')) },
          { path: 'body', lazy: page(() => import('../features/body/BodyPage')) },
          { path: 'more', lazy: page(() => import('../features/more/MorePage')) },
          { path: 'tools', lazy: page(() => import('../features/tools/ToolsPage')) },
          { path: 'settings', lazy: page(() => import('../features/settings/SettingsPage')) },
          { path: 'settings/data', lazy: page(() => import('../features/settings/DataPage')) },
          { path: 'about', lazy: page(() => import('../features/more/AboutPage')) },
          { path: 'recovery', lazy: page(() => import('../features/recovery/RecoveryPage')) },
          { path: '*', lazy: page(() => import('./NotFound')) },
        ],
      },
    ],
  },
]);
