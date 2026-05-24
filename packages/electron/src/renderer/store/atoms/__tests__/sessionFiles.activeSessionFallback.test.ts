import { describe, expect, it } from 'vitest';
import { createStore } from 'jotai';
import {
  sessionFileEditsAtom,
  sessionGitStatusAtom,
  sessionPendingReviewFilesAtom,
  workstreamFileEditsWithActiveSessionAtom,
  workstreamGitStatusWithActiveSessionAtom,
  workstreamPendingReviewFilesWithActiveSessionAtom,
  workstreamSessionScopeKey,
} from '../sessionFiles';
import { sessionChildrenAtom } from '../sessions';

describe('session file workstream active-session fallback', () => {
  it('includes active-session file state when workstream membership is stale', () => {
    const store = createStore();
    const workstreamId = 'workstream-parent';
    const activeSessionId = 'linked-active-session';
    const filePath = '/workspace/packages/electron/src/renderer/components/TrackerMode/validationSummary.ts';

    store.set(sessionFileEditsAtom(activeSessionId), [
      {
        filePath,
        linkType: 'edited',
        operation: 'edit',
        timestamp: '2026-05-23T07:00:00.000Z',
        sessionId: activeSessionId,
      },
    ]);
    store.set(sessionGitStatusAtom(activeSessionId), {
      'packages/electron/src/renderer/components/TrackerMode/validationSummary.ts': {
        status: 'modified',
      },
    });
    store.set(sessionPendingReviewFilesAtom(activeSessionId), new Set([filePath]));

    const scopedKey = workstreamSessionScopeKey(workstreamId, activeSessionId);

    expect(store.get(workstreamFileEditsWithActiveSessionAtom(scopedKey))).toEqual([
      expect.objectContaining({ filePath, sessionId: activeSessionId }),
    ]);
    expect(store.get(workstreamGitStatusWithActiveSessionAtom(scopedKey))).toMatchObject({
      'packages/electron/src/renderer/components/TrackerMode/validationSummary.ts': {
        status: 'modified',
      },
    });
    expect(store.get(workstreamPendingReviewFilesWithActiveSessionAtom(scopedKey))).toEqual(new Set([filePath]));
  });

  it('includes active-session file state alongside stale non-active children', () => {
    const store = createStore();
    const workstreamId = 'workstream-parent';
    const staleChildId = 'stale-child-session';
    const activeSessionId = 'linked-active-session';
    const activeFile = '/workspace/packages/electron/src/renderer/components/TrackerMode/validationSummary.ts';
    const staleFile = '/workspace/packages/electron/src/renderer/components/TrackerMode/TrackerItemDetail.tsx';

    store.set(sessionChildrenAtom(workstreamId), [staleChildId]);
    store.set(sessionFileEditsAtom(staleChildId), [
      {
        filePath: staleFile,
        linkType: 'edited',
        operation: 'edit',
        timestamp: '2026-05-23T06:00:00.000Z',
        sessionId: staleChildId,
      },
    ]);
    store.set(sessionFileEditsAtom(activeSessionId), [
      {
        filePath: activeFile,
        linkType: 'edited',
        operation: 'edit',
        timestamp: '2026-05-23T07:00:00.000Z',
        sessionId: activeSessionId,
      },
    ]);

    const scopedKey = workstreamSessionScopeKey(workstreamId, activeSessionId);

    expect(store.get(workstreamFileEditsWithActiveSessionAtom(scopedKey))).toEqual([
      expect.objectContaining({ filePath: staleFile, sessionId: staleChildId }),
      expect.objectContaining({ filePath: activeFile, sessionId: activeSessionId }),
    ]);
  });
});
