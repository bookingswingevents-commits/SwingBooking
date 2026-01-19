import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createSnapshot } from './snapshot';
import { ITEM_STATUS } from './types';

describe('createSnapshot', () => {
  it('merges program, item, application, and artist data', () => {
    const snapshot = createSnapshot({
      program: { id: 'prog', title: 'Programmation', program_type: 'MULTI_DATES', conditions_json: { fees: { options: [] } } },
      item: {
        id: 'item',
        program_id: 'prog',
        item_type: 'DATE',
        start_date: '2025-01-01',
        end_date: '2025-01-01',
        status: ITEM_STATUS.OPEN,
        meta_json: { week_type: 'CALM' },
      },
      application: { id: 'app', option_json: { label: 'Solo' } },
      artist: { id: 'artist', stage_name: 'Stage', email: 'a@b.com' },
    });

    assert.equal(snapshot.program.id, 'prog');
    assert.equal(snapshot.item.id, 'item');
    assert.equal(snapshot.application.option_json.label, 'Solo');
    assert.equal(snapshot.artist.stage_name, 'Stage');
  });
});
