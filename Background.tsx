import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import api from 'lib/axios';
import { useEffect } from 'react';

const MY_FETCH_TASK = 'background-fetch-task';

// 1. Define the task globally (outside of your component)
TaskManager.defineTask(MY_FETCH_TASK, async () => {
  console.log(`[BackgroundTask] Executing at: ${new Date().toISOString()}`);
  
  try {
    const response = await api.get("/test/data");
    const data = response.data;
    
    console.log('[BackgroundTask] Data Fetched Successfully:', JSON.stringify(data));

    // Return Success to let the OS know the job is done
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch (error) {
    console.error('[BackgroundTask] Fetch failed:', error);
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

export default function Background() {
  useEffect(() => {
    const initTask = async () => {
      // 2. Register the task (typically done once on app mount)
      await BackgroundTask.registerTaskAsync(MY_FETCH_TASK, {
        minimumInterval: 15 * 60, // 15 minutes (minimum allowed interval)
      });
      console.log('BackgroundTask registered.');
    };

    initTask();
  }, []);

  return null; // Renders nothing, only logs
}
