'use client';

import FullCalendar, {
  DateSelectArg,
  EventClickArg,
  EventContentArg,
} from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { useRouter } from 'next/navigation';
import React from 'react';

export type CalendarEvent = {
  id: string;
  title: string;
  start: string;
  end?: string;
  url?: string;
  status?: string | null;
  venueName?: string | null;
  formation?: string | null;
};

type Props = {
  events: CalendarEvent[];
  initialView?: 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay';
  enableDragDrop?: boolean;
  onEventDrop?: (id: string, start: string, end?: string) => Promise<void>;
};

const statusClass = (status?: string | null) => {
  const key = (status || '').toLowerCase();
  if (['confirmed', 'confirmed_client', 'client_approved', 'accepted'].includes(key)) {
    return 'sb-cal-status-confirmed';
  }
  if (['waiting_client', 'pending_client', 'proposal_sent', 'sent', 'artist_accepted'].includes(key)) {
    return 'sb-cal-status-pending';
  }
  if (['declined', 'cancelled', 'canceled', 'refused'].includes(key)) {
    return 'sb-cal-status-cancelled';
  }
  if (['draft', 'pending', 'new'].includes(key)) {
    return 'sb-cal-status-draft';
  }
  return 'sb-cal-status-default';
};

function renderEventContent(eventContent: EventContentArg) {
  const status = eventContent.event.extendedProps.status as string | undefined;
  const statusLabel = status ? status.replace(/_/g, ' ') : '';
  return (
    <div className={`sb-cal-event ${statusClass(status)}`}>
      <div className="sb-cal-title">{eventContent.event.title}</div>
      {statusLabel ? <div className="sb-cal-status">{statusLabel}</div> : null}
    </div>
  );
}

export function CalendarView({
  events,
  initialView = 'dayGridMonth',
  enableDragDrop = false,
  onEventDrop,
}: Props) {
  const router = useRouter();

  const onEventClick = (arg: EventClickArg) => {
    arg.jsEvent.preventDefault();
    const url = (arg.event.extendedProps as any)?.url ?? arg.event.url;
    if (url) {
      router.push(url);
    }
  };

  return (
    <>
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView={initialView}
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,timeGridWeek,timeGridDay',
        }}
        height="auto"
        nowIndicator
        selectable={false}
        events={events}
        eventClick={onEventClick}
        eventDisplay="block"
        eventContent={renderEventContent}
        eventClassNames={(arg) => statusClass((arg.event.extendedProps as any)?.status)}
        editable={enableDragDrop}
        eventDrop={async (info) => {
          if (!enableDragDrop || !onEventDrop) {
            info.revert();
            return;
          }
          const confirmed = window.confirm('Confirmer le déplacement de cet événement ?');
          if (!confirmed) {
            info.revert();
            return;
          }
          try {
            await onEventDrop(
              info.event.id,
              info.event.start?.toISOString() || '',
              info.event.end?.toISOString()
            );
          } catch (e) {
            alert((e as any)?.message || 'Déplacement impossible');
            info.revert();
          }
        }}
      />
      <style jsx global>{`
        .sb-cal-event {
          display: flex;
          flex-direction: column;
          gap: 2px;
          padding: 4px 6px;
          border-radius: 6px;
          color: #0f172a;
          font-size: 12px;
          line-height: 1.2;
        }
        .sb-cal-title {
          font-weight: 600;
        }
        .sb-cal-status {
          font-size: 11px;
          color: #475569;
          text-transform: capitalize;
        }
        .sb-cal-status-confirmed {
          background: #ecfdf3;
          border: 1px solid #bbf7d0;
        }
        .sb-cal-status-pending {
          background: #fff7ed;
          border: 1px solid #fed7aa;
        }
        .sb-cal-status-cancelled {
          background: #f8fafc;
          border: 1px solid #cbd5e1;
          color: #475569;
        }
        .sb-cal-status-draft {
          background: #eef2ff;
          border: 1px solid #c7d2fe;
        }
        .sb-cal-status-default {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
        }
      `}</style>
    </>
  );
}
