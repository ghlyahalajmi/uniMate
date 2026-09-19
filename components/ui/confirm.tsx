'use client';

import { useState } from 'react';
import { useI18n } from '@/lib/i18n/provider';
import { Button } from './primitives';
import { Modal } from './toast';

/**
 * Confirmation for anything destructive. Nothing in this app deletes a row
 * without one of these first.
 */
export function ConfirmDialog({
  open, onClose, onConfirm, title, body, confirmLabel, danger = true,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  title: string;
  body: string;
  confirmLabel?: string;
  danger?: boolean;
}) {
  const { t } = useI18n();
  const [working, setWorking] = useState(false);

  return (
    <Modal
      open={open}
      onClose={working ? () => undefined : onClose}
      title={title}
      description={body}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={working}>
            {t.common.cancel}
          </Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            loading={working}
            onClick={async () => {
              setWorking(true);
              try { await onConfirm(); } finally { setWorking(false); }
            }}
          >
            {confirmLabel ?? t.common.delete}
          </Button>
        </>
      }
    />
  );
}
