import { IsEnum } from 'class-validator';

// Request-shape only — there is deliberately no database enum backing this.
// The stored state is a single `completed Boolean`; PENDING/COMPLETED are
// mapped onto it by TasksService.updateStatus. `completedAt` is absent here
// on purpose: it is generated server-side the moment `completed` becomes
// true (and cleared when it becomes false again), so a caller can never
// claim a completion happened at a time of their choosing — mirrors
// UpdateFollowUpStatusDto's completedAt handling.
export enum TaskStatusInput {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
}

export class UpdateTaskStatusDto {
  @IsEnum(TaskStatusInput)
  status!: TaskStatusInput;
}
