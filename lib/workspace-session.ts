export type WorkspaceSessionStamp = { generation: number; userId: string | null };

/** Guards asynchronous loads/saves across account changes and manual reloads. */
export class WorkspaceSessionGuard {
  private generation = 0;
  private userId: string | null = null;
  busy = false;
  begin(userId: string | null): WorkspaceSessionStamp {
    this.generation += 1;
    this.userId = userId;
    this.busy = true;
    return this.capture();
  }
  capture(): WorkspaceSessionStamp { return {generation:this.generation,userId:this.userId}; }
  isCurrent(stamp: WorkspaceSessionStamp): boolean { return stamp.generation === this.generation && stamp.userId === this.userId; }
  finish(stamp: WorkspaceSessionStamp): boolean {
    if (!this.isCurrent(stamp)) return false;
    this.busy = false;
    return true;
  }
  canSave(userId: string): boolean { return !this.busy && this.userId === userId; }
}
