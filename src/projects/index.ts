/**
 * Модуль «Проекты 1С» — по образцу Project Manager.
 */

export { ProjectStorage } from './storage';
export { ProjectsStack } from './stack';
export { StorageProvider } from './storageProvider';
export { AutodetectProvider } from './autodetectProvider';
export { ProjectsProviders } from './providers';
export { pickProjects, openPickedProject, canSwitchOnActiveWindow } from './projectsPicker';
export { pickTags } from './tagsPicker';
export { showStatusBar, updateStatusBar } from './statusBar';
export { getProjectsFilePath, expandHomePath, normalizePath } from './pathUtils';
export { NO_TAGS_DEFINED, CommandLocation } from './constants';
export type { Project } from './project';
export type { PickedProject, PickedResult } from './projectsPicker';
