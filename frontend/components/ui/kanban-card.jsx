import React from 'react';
import { motion } from 'framer-motion';
import { Draggable } from 'react-beautiful-dnd';
import { MoreHorizontal, User, Mail, Briefcase } from 'lucide-react';
import { Badge } from './badge';

const KanbanCard = ({ candidate, index, onCardClick, onMenuClick }) => {
  const getStageColor = (stage) => {
    const colors = {
      onboarding: 'bg-blue-100 text-blue-800 border-blue-200',
      marketing: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      interviewing: 'bg-purple-100 text-purple-800 border-purple-200',
      offered: 'bg-amber-100 text-amber-800 border-amber-200',
      placed: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    };
    return colors[stage] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getStageLabel = (stage) => {
    const labels = {
      onboarding: 'Onboarding',
      marketing: 'Marketing',
      interviewing: 'Interviewing',
      offered: 'Offered',
      placed: 'Placed',
    };
    return labels[stage] || stage;
  };

  return (
    <Draggable draggableId={`candidate-${candidate.id}`} index={index}>
      {(provided, snapshot) => (
        <motion.div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          whileHover={{ y: -4 }}
          className={`p-4 rounded-lg border-2 cursor-move transition-all ${
            snapshot.isDragging
              ? 'bg-primary/10 border-primary shadow-lg'
              : 'bg-card border-border hover:border-primary/50 shadow-sm'
          }`}
          onClick={() => onCardClick?.(candidate)}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-foreground truncate text-sm">
                {candidate.name}
              </h3>
              <p className="text-xs text-muted-foreground truncate">
                {candidate.email}
              </p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMenuClick?.(candidate);
              }}
              className="p-1 hover:bg-muted rounded transition-colors flex-shrink-0"
            >
              <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          {/* Info */}
          <div className="space-y-2 mb-3">
            {candidate.position && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Briefcase className="h-3 w-3" />
                <span className="truncate">{candidate.position}</span>
              </div>
            )}
            {candidate.recruiter_name && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <User className="h-3 w-3" />
                <span className="truncate">{candidate.recruiter_name}</span>
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="flex items-center justify-between gap-2 mb-3 text-xs">
            <span className="text-muted-foreground">
              <span className="font-semibold text-foreground">
                {candidate.daily_applications || 0}
              </span>{' '}
              today
            </span>
            <span className="text-emerald-600">
              <span className="font-semibold">{candidate.approved_applications || 0}</span> approved
            </span>
          </div>

          {/* Stage Badge */}
          <Badge className={`w-full justify-center text-xs ${getStageColor(candidate.current_stage)}`}>
            {getStageLabel(candidate.current_stage)}
          </Badge>

          {/* Drag Handle Indicator */}
          {snapshot.isDragging && (
            <div className="absolute inset-0 rounded-lg border-2 border-primary pointer-events-none" />
          )}
        </motion.div>
      )}
    </Draggable>
  );
};

export default KanbanCard;
