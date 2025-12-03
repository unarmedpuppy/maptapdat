#!/usr/bin/env python3
import re
import sys

# Read existing entries to check duplicates
existing = set()
try:
    with open('data.csv', 'r') as f:
        for line in f:
            if ',' in line and not line.startswith('user'):
                parts = line.strip().split(',')
                if len(parts) >= 2:
                    existing.add((parts[0].strip(), parts[1].strip()))
except:
    pass

# All entries from the text
entries_text = """
Oct 29: David Ellis: 99! 96" 98" 24❄ 815, Final: 706
Oct 29: Ashley Ellis: 99! 95/ 99! 23? 95/, Final: 746
Oct 29: scott caskey: 97" 95/ 99! 314 96", Final: 771
Oct 30: David Ellis: 96" 100! 98! 89, 54-, Final: 821
Oct 30: scott caskey: 99! 99! 98! 97" 63', Final: 874
Oct 30: Ashley Ellis: 96" 100S 96" 85* 91), Final: 916
Oct 30: Ashley Ellis: 97" 99! 92$ 83* 45+, Final: 764
Oct 30: Abigail Jenquist: 93$ 100! 98" 815 79✨, Final: 869
Oct 31: Ashley Ellis: 97" 91$ 84* 97" 97", Final: 938
Oct 31: David Ellis: 98! 90) 99! 93$ 89,, Final: 932
Oct 31: scott caskey: 92$ 94/ 83* 100! 90), Final: 922
Oct 31: Abigail Jenquist: 91) 92$ 78: 97" 98", Final: 924
Nov 1: David Ellis: 92$ 79✨ 853 53< 96", Final: 788
Nov 1: David Ellis: 99! 815 88, 71( 94/, Final: 851
Nov 1: Abigail Jenquist: 92$ 853 77: 77: 76:, Final: 790
Nov 1: Ashley Ellis: 98" 88, 90) 334 94/, Final: 747
Nov 1: scott caskey: 89, 63' 97" 431 97", Final: 766
Nov 2: Ashley Ellis: 100S 96" 99! 93$ 95/, Final: 958
Nov 2: Ashley Ellis: 100S 863 92$ 99! 90), Final: 937
Nov 2: David Ellis: 100S 83* 91) 97" 89), Final: 923
Nov 2: Abigail Jenquist: 100S 83* 94/ 98! 44+, Final: 797
Nov 2: scott caskey: 99! 83* 99! 95/ 60., Final: 845
Nov 3: David Ellis: 99! 98" 97" 98" 99!, Final: 982
Nov 3: scott caskey: 93$ 100! 96" 93$ 98!, Final: 958
Nov 3: scott caskey: 99! 98! 97" 88, 87,, Final: 916
Nov 3: Ashley Ellis: 92$ 100! 90) 88, 96", Final: 924
Nov 3: Abigail Jenquist: 92$ 98! 93$ 91) 68*, Final: 853
Nov 4: David Ellis: 97" 96" 873 85* 96", Final: 910
Nov 4: scott caskey: 97" 95/ 92$ 99! 314, Final: 766
Nov 4: Ashley Ellis: 95/ 96" 815 67* 100S, Final: 854
Nov 5: David Ellis: 98! 94/ 100S 79✨ 93$, Final: 908
Nov 5: Ashley Ellis: 94/ 88, 100S 72B 815, Final: 841
Nov 5: scott caskey: 98! 873 99! 502 70(, Final: 743
Nov 5: Abigail Jenquist: 863 87, 59. 815 84*, Final: 786
Nov 5: Joshua Jenquist: 97" 97" 100S 79✨ 92$, Final: 907
Nov 6: Ashley Ellis: 93$ 94/ 77: 94/ 95/, Final: 908
Nov 6: David Ellis: 99! 99! 92$ 98" 99!, Final: 973
Nov 6: scott caskey: 94/ 98! 78: 90) 93$, Final: 897
Nov 6: scott caskey: 97" 93$ 668 863 84*, Final: 832
Nov 6: Abigail Jenquist: 91) 88, 668 63@ 68*, Final: 704
Nov 7: David Ellis: 95/ 100S 93$ 89, 18\\, Final: 702
Nov 7: Ashley Ellis: 96" 98! 44+ 94/ 89,, Final: 831
Nov 7: Abigail Jenquist: 97" 99! 379 46I 44+, Final: 540
Nov 7: scott caskey: 98! 100S 56- 83* 766, Final: 787
Nov 7: scott caskey: 93$ 99! 98! 16N 26❄, Final: 514
Nov 8: David Ellis: 99! 93$ 97" 96" 59., Final: 851
Nov 8: Ashley Ellis: 100S 68* 97" 91) 90), Final: 905
Nov 8: scott caskey: 100S 88, 97" 84* 83*, Final: 883
Nov 8: Abigail Jenquist: 100S 80✨ 90) 79✨ 10M, Final: 627
Nov 8: scott caskey: 100S 92$ 98! 98! 91$, Final: 955
Nov 9: David Ellis: 93$ 95/ 98! 97" 90), Final: 945
Nov 9: scott caskey: 99! 96" 91) 88, 93$, Final: 920
Nov 9: scott caskey: 89, 95/ 96" 68* 76:, Final: 808
Nov 9: Abigail Jenquist: 76: 91) 94/ 91) 68*, Final: 832
Nov 9: Ashley Ellis: 90) 94/ 99! 863 93$, Final: 919
Nov 10: David Ellis: 93$ 92$ 98" 825 59., Final: 804
Nov 10: Ashley Ellis: 99! 96" 96/ 97" 97", Final: 969
Nov 10: scott caskey: 99! 98" 95/ 746 502, Final: 759
Nov 10: scott caskey: 96" 89) 97" 815 85*, Final: 877
Nov 10: Abigail Jenquist: 93$ 97" 96/ 55- 19\\, Final: 604
Nov 11: Ashley Ellis: 96" 91$ 94/ 94/ 55-, Final: 822
Nov 11: David Ellis: 98! 98! 94/ 93$ 52<, Final: 819
Nov 11: scott caskey: 97" 97" 96" 93$ 68*, Final: 869
Nov 11: Joshua Jenquist: 97" 96" 99! 98! 73B, Final: 904
Nov 11: Abigail Jenquist: 96" 95/ 99! 92$ 74B, Final: 887
Nov 12: Ashley Ellis: 99! 95/ 93$ 98! 815, Final: 917
Nov 12: David Ellis: 98! 94/ 100S 93$ 815, Final: 914
Nov 12: scott caskey: 97" 98! 96" 99! 84*, Final: 936
Nov 12: Abigail Jenquist: 98! 98" 90) 95/ 84*, Final: 913
Nov 13: David Ellis: 100S 95/ 98! 96" 78:, Final: 913
Nov 13: Ashley Ellis: 100S 98! 98" 100S 78:, Final: 928
Nov 13: scott caskey: 100S 94/ 99! 96" 56-, Final: 848
Nov 13: Joshua Jenquist: 100S 96" 94/ 100S 78:, Final: 918
Nov 13: Abigail Jenquist: 100S 44+ 96" 100S 78:, Final: 870
Nov 14: David Ellis: 99! 98" 99! 99! 98!, Final: 986
Nov 14: Ashley Ellis: 98" 94/ 47I 97" 93$, Final: 856
Nov 14: Abigail Jenquist: 98! 94/ 61' 324 61., Final: 593
Nov 14: Abigail Jenquist: 98" 71( 98! 50J 71(, Final: 728
Nov 15: David Ellis: 97" 99! 853 815 85*, Final: 864
Nov 15: scott caskey: 99! 91$ 62' 96/ 668, Final: 800
Nov 15: Abigail Jenquist: 90) 99! 36F 84* 64@, Final: 705
Nov 16: Ashley Ellis: 96" 99! 99! 73B 45+, Final: 747
Nov 16: David Ellis: 99! 99! 97" 80✨ 78:, Final: 866
Nov 16: Abigail Jenquist: 91) 99! 80✨ 68* 580, Final: 728
Nov 17: David Ellis: 91) 97" 94/ 96" 84*, Final: 916
Nov 17: Abigail Jenquist: 91) 95/ 91) 89) 55-, Final: 800
Nov 18: scott caskey: 93$ 97" 96" 90) 49J, Final: 799
Nov 18: David Ellis: 98" 93$ 95/ 89) 72B, Final: 864
Nov 18: Ashley Ellis: 88, 835 95/ 91) 30O, Final: 724
Nov 18: scott caskey: 95/ 97" 100S 93$ 431, Final: 800
Nov 19: David Ellis: 100! 99! 93$ 89, 88,, Final: 916
Nov 19: Ashley Ellis: 99! 94/ 756 79✨ 756, Final: 805
Nov 19: scott caskey: 96/ 95/ 73B 64@ 69*, Final: 736
Nov 19: Joshua Jenquist: 93$ 98" 825 431 71(, Final: 697
Nov 20: Ashley Ellis: 97" 97" 100S 97" 825, Final: 931
Nov 20: David Ellis: 98" 96" 99! 98! 88,, Final: 950
Nov 20: Abigail Jenquist: 89) 98! 96/ 46I 90), Final: 787
Nov 20: scott caskey: 91$ 99! 100S 22? 89,, Final: 723
Nov 20: scott caskey: 96" 92$ 98" 570 746, Final: 777
Nov 21: David Ellis: 100S 99! 97" 863 97", Final: 942
Nov 22: Joshua Jenquist: 100S 100! 99! 94/ 92$, Final: 956
Nov 22: Abigail Jenquist: 100S 99! 99! 94/ 580, Final: 853
Nov 22: David Ellis: 100S 95/ 90) 44+ 97", Final: 798
Nov 22: scott caskey: 100S 100! 100! 88, 96", Final: 952
Nov 22: Ashley Ellis: 100S 100! 99! 90) 96", Final: 956
Nov 23: David Ellis: 100S 97" 91) 98! 99!, Final: 970
Nov 23: Joshua Jenquist: 100S 98" 96" 863 23?, Final: 717
Nov 23: scott caskey: 99! 97" 65@ 94/ 0K, Final: 608
Nov 23: Ashley Ellis: 100S 93$ 84* 77: 89,, Final: 859
Nov 24: David Ellis: 94/ 99! 570 95/ 98!, Final: 886
Nov 24: Joshua Jenquist: 96" 92$ 853 98" 96", Final: 940
Nov 24: Abigail Jenquist: 94/ 93$ 0K 97" 13>, Final: 517
Nov 24: Ashley Ellis: 97" 90) 96" 98! 863, Final: 931
Nov 24: scott caskey: 94/ 96" 96/ 97" 59., Final: 850
Nov 25: Ashley Ellis: 96" 95/ 100S 98" 27G, Final: 766
Nov 25: David Ellis: 98! 93$ 98! 84* 314, Final: 732
Nov 25: Abigail Jenquist: 96" 92$ 853 4K 431, Final: 499
Nov 25: scott caskey: 90) 98! 100S 4K 19\\, Final: 457
Nov 25: Joshua Jenquist: 98! 90) 100S 3K 0K, Final: 397
Nov 27: David Ellis: 96" 94/ 99! 825 88,, Final: 898
Nov 27: Joshua Jenquist: 96" 91) 99! 97" 70(, Final: 886
Nov 27: Ashley Ellis: 97" 94/ 94/ 72B 835, Final: 844
Nov 27: scott caskey: 97" 97" 83* 90) 89,, Final: 897
Nov 28: David Ellis: 87, 98! 96" 95/ 95/, Final: 947
Nov 28: Ashley Ellis: 95/ 99! 96" 95/ 15A, Final: 716
Nov 28: Joshua Jenquist: 92$ 95/ 97" 93$ 0K, Final: 660
Nov 28: scott caskey: 94/ 97" 97" 89, 324, Final: 748
Nov 28: Abigail Jenquist: 91) 94/ 99! 77: 4K, Final: 626
Nov 29: Ashley Ellis: 94/ 98" 99! 96" 84*, Final: 930
Nov 29: David Ellis: 96" 98" 97" 93$ 93$, Final: 946
Nov 29: Joshua Jenquist: 97" 98! 98! 97" 863, Final: 940
Nov 29: Abigail Jenquist: 97" 98! 68* 91) 85*, Final: 859
Nov 30: Joshua Jenquist: 100! 91) 95/ 95/ 69*, Final: 873
Nov 30: scott caskey: 98! 89, 96" 95/ 502, Final: 814
Nov 30: Ashley Ellis: 91) 80✨ 84* 93$ 91), Final: 891
Nov 30: David Ellis: 99! 92$ 95/ 96" 94/, Final: 951
Dec 1: David Ellis: 97" 98! 91$ 97" 815, Final: 911
Dec 1: Abigail Jenquist: 98! 94/ 62' 580 71(, Final: 703
Dec 1: Joshua Jenquist: 99! 94/ 92$ 91) 91), Final: 923
Dec 1: Ashley Ellis: 99! 97" 92$ 99! 570, Final: 848
Dec 1: scott caskey: 100! 98" 90) 90) 95/, Final: 933
Dec 2: David Ellis: 96/ 93$ 97" 92$ 863, Final: 917
Dec 2: Ashley Ellis: 89) 99! 94/ 90) 91), Final: 919
Dec 2: scott caskey: 99! 95/ 96" 99! 853, Final: 938
Dec 2: Abigail Jenquist: 94/ 89, 61. 84* 668, Final: 755
Dec 2: Joshua Jenquist: 95/ 92$ 96" 93$ 62', Final: 844
"""

# Parse and format entries
new_rows = []
for line in entries_text.strip().split('\n'):
    if not line.strip():
        continue
    # Parse: Oct 29: David Ellis: 99! 96" 98" 24❄ 815, Final: 706
    match = re.match(r'(Oct|Nov|Dec|October|November|December)\s+(\d+):\s*([^:]+):\s*([^,]+),\s*Final:\s*(\d+)', line)
    if match:
        month_str = match.group(1)
        day = match.group(2)
        user = match.group(3).strip()
        scores_str = match.group(4).strip()
        final = match.group(5)
        
        # Convert month
        months = {'Oct': '10', 'October': '10', 'Nov': '11', 'November': '11', 'Dec': '12', 'December': '12'}
        month = months.get(month_str, '12')
        date = f"2025-{month}-{day.zfill(2)}"
        
        # Parse scores
        score_pattern = r'(\d+)([^\d\s]{1,3})'
        scores = re.findall(score_pattern, scores_str)
        
        if len(scores) == 5 and (user, date) not in existing:
            for i, (score, emoji) in enumerate(scores, 1):
                new_rows.append(f"{user},{date},{i},{score},{emoji},{final}")

# Output new rows
for row in new_rows:
    print(row)

