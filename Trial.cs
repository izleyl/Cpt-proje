namespace Cpt_proje
{
    public class Trial
    {
        public int TrialId { get; set; }
        public int SessionId { get; set; }
        public int TrialIndex { get; set; }
        public string StimulusType { get; set; } = string.Empty; // 'target' veya 'nontarget'
        public long StimulusOnsetMs { get; set; }
        public long? ResponseMs { get; set; }
        public long? RtMs { get; set; } // Tepki süresi[cite: 1]
        public string? Outcome { get; set; } // 'hit', 'omission', vs.[cite: 1]
        public int DistractorActive { get; set; } // 0 veya 1[cite: 1]
    }
}
