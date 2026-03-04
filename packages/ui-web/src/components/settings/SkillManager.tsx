// Simplified Skill Manager — skills are now parsed from SKILL.md and injected into system prompt

import { useEffect } from 'react';
import { useSkillStore } from '@shared/stores/skills';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';

export function SkillManager() {
  const { skills, loadSkills } = useSkillStore();

  useEffect(() => {
    loadSkills();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Skills</h3>
        <p className="text-sm text-muted-foreground mt-1">
          {skills.length} {skills.length === 1 ? 'skill' : 'skills'} available.
          Skills are automatically injected into the system prompt.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {skills.length === 0 ? (
          <Card className="col-span-full p-8 text-center text-muted-foreground">
            <p>No skills available</p>
          </Card>
        ) : (
          skills.map((skill) => (
            <Card key={skill.id} className="p-4">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold">{skill.name}</h4>
                    <Badge variant="secondary" className="text-xs">Built-in</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {skill.description}
                  </p>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
