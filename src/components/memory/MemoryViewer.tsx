import { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { ScrollArea } from '../ui/scroll-area';
import { Label } from '../ui/label';
import { Button } from '../ui/button';
import { Calendar } from '../ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Input } from '../ui/input';
import { Brain, Search, Calendar as CalendarIcon, BarChart3, Eye, Edit2, BookOpen, Flame } from 'lucide-react';
import { fileSystem } from '../../services/filesystem';
import ReactMarkdown from '../ReactMarkdown';

const MEMORY_DIR = '/sandbox/.memory';
const MEMORY_FILE = '/sandbox/.memory/MEMORY.md';

interface MemoryViewerProps {
  isOpen: boolean;
  onClose: () => void;
}

interface DiaryEntry {
  name: string;
  size: number;
  date: string;
}

export function MemoryViewer({ isOpen, onClose }: MemoryViewerProps) {
  const { t } = useTranslation();

  // Tab state
  const [activeTab, setActiveTab] = useState('memory');

  // Memory state
  const [memoryContent, setMemoryContent] = useState('');
  const [memoryDirty, setMemoryDirty] = useState(false);
  const [memorySaved, setMemorySaved] = useState(false);
  const [memoryPreview, setMemoryPreview] = useState(false);

  // Diary state
  const [diaryList, setDiaryList] = useState<DiaryEntry[]>([]);
  const [diaryDates, setDiaryDates] = useState<Set<string>>(new Set());
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());
  const [currentDiary, setCurrentDiary] = useState<{ date: string; content: string } | null>(null);
  const [diaryDirty, setDiaryDirty] = useState(false);
  const [diarySaved, setDiarySaved] = useState(false);
  const [diaryPreview, setDiaryPreview] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [loading, setLoading] = useState(false);
  const memoryRef = useRef<HTMLTextAreaElement>(null);
  const diaryRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      setActiveTab('memory');
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    setLoading(true);
    try {
      await fileSystem.initialize();
      if (!(await fileSystem.exists(MEMORY_DIR))) {
        await fileSystem.mkdir(MEMORY_DIR);
      }

      // Load memory
      const content = await fileSystem.readFileText(MEMORY_FILE);
      setMemoryContent(content || '');
      setMemoryDirty(false);
      setMemorySaved(false);

      // Load diaries
      const entries = await fileSystem.readdir(MEMORY_DIR);
      const diaries = entries
        .filter(e => e.type === 'file' && e.name !== 'MEMORY.md' && e.name.endsWith('.md'))
        .map(d => ({
          name: d.name,
          size: d.size,
          date: d.name.replace('.md', '')
        }))
        .sort((a, b) => b.date.localeCompare(a.date));

      setDiaryList(diaries);
      setDiaryDates(new Set(diaries.map(d => d.date)));
    } catch {
      setMemoryContent('');
      setDiaryList([]);
      setDiaryDates(new Set());
    } finally {
      setLoading(false);
    }
  };

  const saveMemory = async () => {
    await fileSystem.initialize();
    if (!(await fileSystem.exists(MEMORY_DIR))) {
      await fileSystem.mkdir(MEMORY_DIR);
    }
    await fileSystem.writeFile(MEMORY_FILE, memoryContent);
    setMemoryDirty(false);
    setMemorySaved(true);
    setTimeout(() => setMemorySaved(false), 2000);
  };

  const openDiary = async (date: string) => {
    setLoading(true);
    try {
      const content = await fileSystem.readFileText(`${MEMORY_DIR}/${date}.md`);
      setCurrentDiary({ date, content: content || '' });
      setDiaryDirty(false);
      setDiarySaved(false);
      setDiaryPreview(false);
      setSelectedDate(new Date(date));
      setActiveTab('diary'); // Switch to diary tab
    } catch {
      setCurrentDiary({ date, content: '' });
      setActiveTab('diary'); // Switch to diary tab even on error
    } finally {
      setLoading(false);
    }
  };

  const saveDiary = async () => {
    if (!currentDiary) return;
    await fileSystem.writeFile(`${MEMORY_DIR}/${currentDiary.date}.md`, currentDiary.content);
    setDiaryDirty(false);
    setDiarySaved(true);
    setTimeout(() => setDiarySaved(false), 2000);
    await loadData();
  };

  const closeDiary = () => {
    setCurrentDiary(null);
    setSelectedDate(undefined);
    setDiaryPreview(false);
  };

  const formatDateToLocal = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;
    const dateStr = formatDateToLocal(date);
    openDiary(dateStr);
  };

  const openTodayDiary = () => {
    const today = formatDateToLocal(new Date());
    openDiary(today);
  };

  const modifiers = {
    hasDiary: (date: Date) => {
      const dateStr = formatDateToLocal(date);
      return diaryDates.has(dateStr);
    }
  };

  const modifiersClassNames = {
    hasDiary: 'relative after:content-[""] after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:w-1 after:h-1 after:rounded-full after:bg-primary font-semibold text-primary',
  };

  // Diary statistics
  const diaryStats = useMemo(() => {
    const totalDiaries = diaryList.length;
    const totalWords = diaryList.reduce((sum, d) => sum + d.size, 0);

    // Calculate streak
    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < 365; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(today.getDate() - i);
      const dateStr = formatDateToLocal(checkDate);

      if (diaryDates.has(dateStr)) {
        streak++;
      } else if (i > 0) {
        break;
      }
    }

    return { totalDiaries, totalWords, streak };
  }, [diaryList, diaryDates]);

  // Filtered diary list based on search
  const filteredDiaryList = useMemo(() => {
    if (!searchQuery.trim()) return diaryList;
    const query = searchQuery.toLowerCase();
    return diaryList.filter(d => d.date.includes(query));
  }, [diaryList, searchQuery]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[1100px] h-[750px] max-w-[90vw] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5" />
            {t('tools.memory.name')}
          </DialogTitle>
        </DialogHeader>

        {loading && !currentDiary ? (
          <p className="text-sm text-muted-foreground py-4">{t('common.loading')}</p>
        ) : (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Tab Switcher */}
            <div className="grid grid-cols-2 mx-0 mb-3 bg-muted/50 rounded-md p-1 shrink-0">
              <button
                onClick={() => setActiveTab('memory')}
                className={`flex items-center justify-center gap-2 text-xs px-3 py-1.5 rounded-sm transition-colors ${
                  activeTab === 'memory'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Brain className="w-3.5 h-3.5" />
                {t('tools.memory.tabMemory')}
              </button>
              <button
                onClick={() => setActiveTab('diary')}
                className={`flex items-center justify-center gap-2 text-xs px-3 py-1.5 rounded-sm transition-colors ${
                  activeTab === 'diary'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                {t('tools.memory.tabDiary')}
              </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 min-h-0">
              {activeTab === 'memory' ? (
                // Long-term Memory View
                <div className="flex flex-col gap-3 h-full">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">{t('tools.memory.memoryContent')}</Label>
                    <div className="flex items-center gap-2">
                      {memorySaved && (
                        <span className="text-xs text-green-600">{t('tools.memory.saved')}</span>
                      )}
                      {memoryDirty && (
                        <span className="text-xs text-muted-foreground">{t('tools.memory.editing')}</span>
                      )}
                      <Button
                        onClick={() => setMemoryPreview(!memoryPreview)}
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                      >
                        {memoryPreview ? (
                          <>
                            <Edit2 className="w-3 h-3 mr-1" />
                            {t('tools.memory.edit')}
                          </>
                        ) : (
                          <>
                            <Eye className="w-3 h-3 mr-1" />
                            {t('tools.memory.preview')}
                          </>
                        )}
                      </Button>
                      <Button
                        onClick={saveMemory}
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        disabled={!memoryDirty}
                      >
                        {t('common.save')}
                      </Button>
                    </div>
                  </div>

                  {memoryPreview ? (
                    <ScrollArea className="flex-1 rounded-md border bg-muted/30 p-4">
                      <ReactMarkdown content={memoryContent || t('tools.memory.noMemoryYet')} />
                    </ScrollArea>
                  ) : (
                    <textarea
                      ref={memoryRef}
                      value={memoryContent}
                      onChange={(e) => { setMemoryContent(e.target.value); setMemoryDirty(true); setMemorySaved(false); }}
                      onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); saveMemory(); } }}
                      className="flex-1 rounded-md border bg-muted/30 p-3 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                      placeholder={t('tools.memory.noMemoryYet')}
                      spellCheck={false}
                    />
                  )}
                </div>
              ) : (
                // Diary View
                <div className="flex flex-col gap-3 h-full">
                  {currentDiary ? (
                    // Diary Editor View
                    <>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Button onClick={closeDiary} variant="ghost" size="sm" className="h-7 text-xs">
                            ← {t('tools.memory.back')}
                          </Button>
                          <Label className="text-sm font-medium">📅 {currentDiary.date}</Label>
                        </div>
                        <div className="flex items-center gap-2">
                          {diarySaved && (
                            <span className="text-xs text-green-600">{t('tools.memory.saved')}</span>
                          )}
                          {diaryDirty && (
                            <span className="text-xs text-muted-foreground">{t('tools.memory.editing')}</span>
                          )}
                          <Button
                            onClick={() => setDiaryPreview(!diaryPreview)}
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                          >
                            {diaryPreview ? (
                              <>
                                <Edit2 className="w-3 h-3 mr-1" />
                                {t('tools.memory.edit')}
                              </>
                            ) : (
                              <>
                                <Eye className="w-3 h-3 mr-1" />
                                {t('tools.memory.preview')}
                              </>
                            )}
                          </Button>
                          <Button
                            onClick={saveDiary}
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            disabled={!diaryDirty}
                          >
                            {t('common.save')}
                          </Button>
                        </div>
                      </div>

                      {diaryPreview ? (
                        <ScrollArea className="flex-1 rounded-md border bg-muted/30 p-4">
                          <ReactMarkdown content={currentDiary.content || t('tools.memory.noDiariesYet')} />
                        </ScrollArea>
                      ) : (
                        <textarea
                          ref={diaryRef}
                          value={currentDiary.content}
                          onChange={(e) => {
                            setCurrentDiary({ ...currentDiary, content: e.target.value });
                            setDiaryDirty(true);
                            setDiarySaved(false);
                          }}
                          onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); saveDiary(); } }}
                          className="flex-1 rounded-md border bg-muted/30 p-3 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                          spellCheck={false}
                        />
                      )}
                    </>
                  ) : (
                    // Diary List View
                    <>
                      {/* Statistics Cards */}
                      <div className="grid grid-cols-3 gap-2 shrink-0">
                        <div className="rounded-lg border bg-muted/30 p-2">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                            <CalendarIcon className="w-3 h-3" />
                            {t('tools.memory.totalDiaries')}
                          </div>
                          <div className="text-xl font-semibold">{diaryStats.totalDiaries}</div>
                        </div>
                        <div className="rounded-lg border bg-muted/30 p-2">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                            <BarChart3 className="w-3 h-3" />
                            {t('tools.memory.totalWords')}
                          </div>
                          <div className="text-xl font-semibold">
                            {diaryStats.totalWords < 1024
                              ? `${diaryStats.totalWords} B`
                              : `${(diaryStats.totalWords / 1024).toFixed(1)} KB`}
                          </div>
                        </div>
                        <div className="rounded-lg border bg-muted/30 p-2">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                            <Flame className="w-3 h-3" />
                            {t('tools.memory.streak')}
                          </div>
                          <div className="text-xl font-semibold">
                            {diaryStats.streak} {t('tools.memory.streakDays')}
                          </div>
                        </div>
                      </div>

                      {/* Quick Actions */}
                      <div className="flex gap-2 shrink-0">
                        <Button onClick={openTodayDiary} size="sm" className="h-8 text-xs">
                          <CalendarIcon className="w-3 h-3 mr-1" />
                          {t('tools.memory.todayDiary')}
                        </Button>
                        <div className="relative flex-1">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                          <Input
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder={t('tools.memory.searchPlaceholder')}
                            className="h-8 text-xs pl-8"
                          />
                        </div>
                      </div>

                      {/* Calendar and List */}
                      <div className="flex gap-3 flex-1 min-h-0">
                        <div className="shrink-0">
                          <div className="border rounded-md bg-muted/30 p-2">
                            <Calendar
                              mode="single"
                              selected={selectedDate}
                              onSelect={handleDateSelect}
                              month={calendarMonth}
                              onMonthChange={setCalendarMonth}
                              modifiers={modifiers}
                              modifiersClassNames={modifiersClassNames}
                              className="rounded-md"
                              hideNavigation
                              components={{
                                CaptionLabel: () => (
                                  <div className="flex gap-1.5 items-center">
                                    <Select
                                      value={calendarMonth.getFullYear().toString()}
                                      onValueChange={(year) => {
                                        const newDate = new Date(calendarMonth);
                                        newDate.setFullYear(parseInt(year));
                                        setCalendarMonth(newDate);
                                      }}
                                    >
                                      <SelectTrigger className="h-7 text-xs w-[78px] border-none shadow-none px-2">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i).map(year => (
                                          <SelectItem key={year} value={year.toString()}>
                                            {year}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    <Select
                                      value={(calendarMonth.getMonth() + 1).toString()}
                                      onValueChange={(month) => {
                                        const newDate = new Date(calendarMonth);
                                        newDate.setMonth(parseInt(month) - 1);
                                        setCalendarMonth(newDate);
                                      }}
                                    >
                                      <SelectTrigger className="h-7 text-xs w-[62px] border-none shadow-none px-2">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                                          <SelectItem key={month} value={month.toString()}>
                                            {month}月
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                ),
                              }}
                            />
                          </div>
                        </div>

                        <div className="flex-1 min-w-0">
                          <ScrollArea className="h-full rounded-md border bg-muted/30 p-3">
                            {filteredDiaryList.length === 0 ? (
                              <p className="text-xs text-muted-foreground">
                                {searchQuery ? `No results for "${searchQuery}"` : t('tools.memory.noDiariesYet')}
                              </p>
                            ) : (
                              <div className="space-y-1">
                                {filteredDiaryList.map(d => (
                                  <div
                                    key={d.name}
                                    onClick={() => openDiary(d.date)}
                                    className="flex items-center justify-between text-xs py-1.5 px-2 rounded cursor-pointer hover:bg-muted transition-colors"
                                  >
                                    <span className="font-mono">📅 {d.date}</span>
                                    <span className="text-muted-foreground">
                                      {d.size < 1024 ? `${d.size} B` : `${(d.size / 1024).toFixed(1)} KB`}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </ScrollArea>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
