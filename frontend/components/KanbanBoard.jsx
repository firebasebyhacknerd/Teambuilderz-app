import React, { useState, useCallback, useMemo } from 'react';
import { DragDropContext, Droppable } from 'react-beautiful-dnd';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Filter, Settings, TrendingUp } from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import KanbanCard from './ui/kanban-card';
import toast from 'react-hot-toast';

/**
 * Kanban Board Component for candidate pipeline management
 * 
 * Features:
 * - Drag and drop candidates between stages
 * - Visual pipeline overview
 * - Performance metrics per stage
 * - Filter by recruiter/date
 * - Quick actions on cards
 */
const KanbanBoard = ({ 
  candidates = [], 
  onCandidateMove = null,
  onCardClick = null,
  onAddCandidate = null,
  loading = false 
}) => {
  const [filteredCandidates, setFilteredCandidates] = useState(candidates);
  const [selectedRecruiter, setSelectedRecruiter] = useState('all');

  // Define stages
  const stages = [
    { id: 'onboarding', label: 'Onboarding', color: 'bg-blue-50 border-blue-200' },
    { id: 'marketing', label: 'Marketing', color: 'bg-yellow-50 border-yellow-200' },
    { id: 'interviewing', label: 'Interviewing', color: 'bg-purple-50 border-purple-200' },
    { id: 'offered', label: 'Offered', color: 'bg-amber-50 border-amber-200' },
    { id: 'placed', label: 'Placed', color: 'bg-emerald-50 border-emerald-200' },
  ];

  // Update filtered candidates when input changes
  React.useEffect(() => {
    let filtered = candidates;
    if (selectedRecruiter !== 'all') {
      filtered = filtered.filter((c) => c.assigned_recruiter_id === parseInt(selectedRecruiter));
    }
    setFilteredCandidates(filtered);
  }, [candidates, selectedRecruiter]);

  // Get unique recruiters
  const recruiters = useMemo(() => {
    const unique = {};
    candidates.forEach((c) => {
      if (c.assigned_recruiter_id && c.recruiter_name) {
        unique[c.assigned_recruiter_id] = c.recruiter_name;
      }
    });
    return Object.entries(unique).map(([id, name]) => ({ id, name }));
  }, [candidates]);

  // Get candidates for a stage
  const getCandidatesForStage = (stageId) => {
    return filteredCandidates.filter((c) => c.current_stage === stageId);
  };

  // Calculate stage metrics
  const getStageMetrics = (stageId) => {
    const stageCandidates = getCandidatesForStage(stageId);
    return {
      count: stageCandidates.length,
      avgApplications: stageCandidates.length > 0
        ? Math.round(
            stageCandidates.reduce((sum, c) => sum + (c.daily_applications || 0), 0) /
              stageCandidates.length
          )
        : 0,
      totalApproved: stageCandidates.reduce((sum, c) => sum + (c.approved_applications || 0), 0),
    };
  };

  // Handle drag end
  const handleDragEnd = (result) => {
    const { source, destination, draggableId } = result;

    // If dropped outside a valid droppable area
    if (!destination) {
      return;
    }

    // If dropped in the same position
    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    ) {
      return;
    }

    const candidateId = parseInt(draggableId.split('-')[1]);
    const newStage = destination.droppableId;

    // Find candidate
    const candidate = candidates.find((c) => c.id === candidateId);
    if (!candidate) return;

    // Call callback
    if (onCandidateMove) {
      onCandidateMove(candidateId, newStage);
      toast.success(`${candidate.name} moved to ${stages.find((s) => s.id === newStage)?.label}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Candidate Pipeline</h2>
          <p className="text-sm text-muted-foreground">
            {filteredCandidates.length} candidates in pipeline
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Recruiter Filter */}
          <select
            value={selectedRecruiter}
            onChange={(e) => setSelectedRecruiter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-border bg-card text-sm"
          >
            <option value="all">All Recruiters</option>
            {recruiters.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>

          {/* Action Buttons */}
          <Button variant="outline" size="sm" className="gap-2">
            <Filter className="h-4 w-4" />
            Filter
          </Button>
          <Button variant="outline" size="sm" className="gap-2">
            <Settings className="h-4 w-4" />
            Settings
          </Button>
          <Button onClick={onAddCandidate} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Candidate
          </Button>
        </div>
      </div>

      {/* Kanban Board */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 overflow-x-auto pb-4">
          {stages.map((stage) => {
            const stageCandidates = getCandidatesForStage(stage.id);
            const metrics = getStageMetrics(stage.id);

            return (
              <motion.div
                key={stage.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex-shrink-0 w-full lg:w-auto"
              >
                <Card className={`h-full flex flex-col border-2 ${stage.color}`}>
                  {/* Stage Header */}
                  <div className="p-4 border-b border-border">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <h3 className="font-semibold text-foreground">{stage.label}</h3>
                      <span className="px-2 py-1 bg-primary/10 text-primary text-xs font-semibold rounded-full">
                        {metrics.count}
                      </span>
                    </div>

                    {/* Metrics */}
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <div className="flex items-center justify-between">
                        <span>Avg Applications:</span>
                        <span className="font-semibold text-foreground">{metrics.avgApplications}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Total Approved:</span>
                        <span className="font-semibold text-emerald-600">{metrics.totalApproved}</span>
                      </div>
                    </div>
                  </div>

                  {/* Cards Container */}
                  <Droppable droppableId={stage.id}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`flex-1 p-4 space-y-3 overflow-y-auto transition-colors ${
                          snapshot.isDraggingOver ? 'bg-primary/5' : ''
                        }`}
                      >
                        <AnimatePresence>
                          {stageCandidates.length === 0 ? (
                            <div className="flex items-center justify-center h-32 text-center">
                              <p className="text-sm text-muted-foreground">
                                No candidates yet
                              </p>
                            </div>
                          ) : (
                            stageCandidates.map((candidate, index) => (
                              <KanbanCard
                                key={candidate.id}
                                candidate={candidate}
                                index={index}
                                onCardClick={onCardClick}
                                onMenuClick={(c) => {
                                  // Handle menu click
                                }}
                              />
                            ))
                          )}
                        </AnimatePresence>
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>

                  {/* Stage Footer */}
                  <div className="p-4 border-t border-border bg-muted/30">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full gap-2"
                      onClick={onAddCandidate}
                    >
                      <Plus className="h-4 w-4" />
                      Add to {stage.label}
                    </Button>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </DragDropContext>

      {/* Summary Stats */}
      <Card className="p-6 bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-6 w-6 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">Pipeline Summary</p>
              <p className="text-lg font-semibold text-foreground">
                {filteredCandidates.length} candidates • {stages.length} stages
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-primary">
                {filteredCandidates.reduce((sum, c) => sum + (c.daily_applications || 0), 0)}
              </p>
              <p className="text-xs text-muted-foreground">Total Applications</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-emerald-600">
                {filteredCandidates.reduce((sum, c) => sum + (c.approved_applications || 0), 0)}
              </p>
              <p className="text-xs text-muted-foreground">Approved</p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default KanbanBoard;
