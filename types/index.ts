export type Role = 'ADMIN' | 'DEPARTMENT_MANAGER' | 'MEMBER';
export type Standard = 'DIN' | 'SMS';
export type ProductType = 'HYGIENIC' | 'ULTRA_HYGIENIC';
export type ModuleStatus =
  | 'DRAFT'
  | 'IN_PROGRESS'
  | 'REVIEW'
  | 'APPROVED'
  | 'DOCUMENT_GENERATED'
  | 'ARCHIVED'
  | 'CANCELLED';
export type ProjectStatus = 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'ARCHIVED';
export type ValveType = 'SDE44' | 'DE44' | 'D44SL' | 'DA44';
export type ControlUnitType = 'NONE' | 'AS_I' | 'DC';
export type WaterInletType = 'SW_CIP42' | 'SD42';
export type SamplingValveType = 'MANUAL' | 'WITH_ACTUATOR';
export type AgitatorPosition = 'SIDE' | 'TOP';
export type CipBallType = 'STATIC' | 'ROTARY';
export type TankOutletValveType = 'MANUAL' | 'WITH_ACTUATOR';
export type TankOutletValveSubType = 'BUTTERFLY' | 'SINGLE_SEAT';
export type AIReviewStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'PARTIAL';

export interface ApiResponse<T = unknown> {
  success: true;
  data: T;
  message?: string;
}

export interface ApiError {
  success: false;
  error: string;
  details?: unknown;
}

export type ApiResult<T = unknown> = ApiResponse<T> | ApiError;
