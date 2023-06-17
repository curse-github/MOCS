# Raspberry Pi Minecraft Block NFC Data
# Author: Tony DiCola
# Copyright (c) 2015 Adafruit Industries
#
# Permission is hereby granted, free of charge, to any person obtaining a copy
# of this software and associated documentation files (the "Software"), to deal
# in the Software without restriction, including without limitation the rights
# to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
# copies of the Software, and to permit persons to whom the Software is
# furnished to do so, subject to the following conditions:
#
# The above copyright notice and this permission notice shall be included in all
# copies or substantial portions of the Software.
#
# THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
# IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
# FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
# AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
# LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
# OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
# SOFTWARE.

# List of tuples with block names and types.
# This is taken from the list at:
#   http://www.stuffaboutcode.com/p/minecraft-api-reference.html

BLOCKS = [
    ('Air'                , 0),
    ('Stone'              , 1),
    ('Grass'              , 2),
    ('Dirt'               , 3),
    ('Cobblestone'        , 4),
    ('Wood planks'        , 5),
    ('Sapling'            , 6),
    ('Bedrock'            , 7),
    ('Water, flowing'     , 8),
    ('Water, stationary'  , 9),
    ('Lava, flowing'      , 10),
    ('Lava, stationary'   , 11),
    ('Sand'               , 12),
    ('Gravel'             , 13),
    ('Gold ore'           , 14),
    ('Iron ore'           , 15),
    ('Coal ore'           , 16),
    ('Wood'               , 17),
    ('Leaves'             , 18),
    ('Glass'              , 20),
    ('Lapis lazuli ore'   , 21),
    ('Lapis lazuli block' , 22),
    ('Sandstone'          , 24),
    ('Bed'                , 26),
    ('Cobweb'             , 30),
    ('Grass, tall'        , 31),
    ('Wool'               , 35),
    ('Flower, yellow'     , 37),
    ('Flower, cyan'       , 38),
    ('Mushroom, brown'    , 39),
    ('Mushroom, red'      , 40),
    ('Gold block'         , 41),
    ('Iron block'         , 42),
    ('Stone slab, double' , 43),
    ('Stone slab'         , 44),
    ('Brick block'        , 45),
    ('TNT'                , 46),
    ('Bookshelf'          , 47),
    ('Moss stone'         , 48),
    ('Obsidian'           , 49),
    ('Torch'              , 50),
    ('Fire'               , 51),
    ('Stairs, wood'       , 53),
    ('Chest'              , 54),
    ('Diamond ore'        , 56),
    ('Diamond block'      , 57),
    ('Crafting table'     , 58),
    ('Farmland'           , 60),
    ('Furnace, inactive'  , 61),
    ('Furnace, active'    , 62),
    ('Door, wood'         , 64),
    ('Ladder'             , 65),
    ('Stairs, cobblestone', 67),
    ('Door, iron'         , 71),
    ('Redstone ore'       , 73),
    ('Snow'               , 78),
    ('Ice'                , 79),
    ('Bedrock, invisible' , 95),
    ('Snow block'         , 80),
    ('Cactus'             , 81),
    ('Clay'               , 82),
    ('Fence'              , 85),
    ('Sugar cane'         , 83),
    ('Glowstone block'    , 89),
    ('Stone, brick'       , 98),
    ('Glass pane'         , 102),
    ('Melon'              , 103),
    ('Fence gate'         , 107),
    ('Glowing obsidian'   , 246),
    ('Nether reactor core', 247),
]

# Mapping of block types to possible subtypes.
# The key of each item is the block name and the value is a list of tuples with
# the subtype value and name.  Again this is taken from the same source as the
# block list above.
SUBTYPES = {
    'Wool': {# 35
        0: 'White',
        1: 'Orange',
        2: 'Magenta',
        3: 'Light Blue',
        4: 'Yellow',
        5: 'Lime',
        6: 'Pink',
        7: 'Grey',
        8: 'Light grey',
        9: 'Cyan',
        10: 'Purple',
        11: 'Blue',
        12: 'Brown',
        13: 'Green',
        14: 'Red',
        15: 'Black'
    },
    'Wood': {# 17
        0: 'Oak',
        1: 'Spruce',
        2: 'Birch'
    },
    'Sapling': {# 6
        0: 'Oak',
        1: 'Spruce',
        2: 'Birch'
    },
    'Grass, tall': {# 31
        0: 'Shrub',
        1: 'Grass',
        2: 'Fern'
    },
    'Torch': {# 50
        1: 'Pointing east',
        2: 'Pointing west',
        3: 'Pointing south',
        4: 'Pointing north',
        5: 'Facing up'
    },
    'Stone, brick': {# 98
        0: 'Stone brick',
        1: 'Mossy stone brick',
        2: 'Cracked stone brick',
        3: 'Chiseled stone brick'
    },
    'Stone slab': {# 44
        0: 'Stone',
        1: 'Sandstone',
        2: 'Wooden',
        3: 'Cobblestone',
        4: 'Brick',
        5: 'Stone Brick'
    },
    'Stone slab, double': {# 43
        0: 'Stone',
        1: 'Sandstone',
        2: 'Wooden',
        3: 'Cobblestone',
        4: 'Brick',
        5: 'Stone Brick'
    },
    'TNT': {# 46
        0: 'Inactive',
        1: 'Ready to explode'
    },
    'Leaves': {# 18
        1: 'Oak leaves',
        2: 'Spruce leaves',
        3: 'Birch leaves'
    },
    'Sandstone': {# 24
        0: 'Sandstone',
        1: 'Chiseled sandstone',
        2: 'Smooth sandstone'
    },
    'Stairs, wood': {# 53
        0: 'Ascending east',
        1: 'Ascending west',
        2: 'Ascending south',
        3: 'Ascending north',
        4: 'Ascending east (upside down)',
        5: 'Ascending west (upside down)',
        6: 'Ascending south (upside down)',
        7: 'Ascending north (upside down)'
    },
    'Stairs, cobblestone': {# 67
        0: 'Ascending east',
        1: 'Ascending west',
        2: 'Ascending south',
        3: 'Ascending north',
        4: 'Ascending east (upside down)',
        5: 'Ascending west (upside down)',
        6: 'Ascending south (upside down)',
        7: 'Ascending north (upside down)'
    },
    'Ladder': {# 65
        2: 'Facing north',
        3: 'Facing south',
        4: 'Facing west',
        5: 'Facing east'
    },
    'Chest': {# 54
        2: 'Facing north',
        3: 'Facing south',
        4: 'Facing west',
        5: 'Facing east'
    },
    'Furnace, inactive': {# 61
        2: 'Facing north',
        3: 'Facing south',
        4: 'Facing west',
        5: 'Facing east'
    },
    'Furnace, active': {# 62
        2: 'Facing north',
        3: 'Facing south',
        4: 'Facing west',
        5: 'Facing east'
    },
    'Water, stationary': {# 9
        0: 'Level 0 (highest)',
        1: 'Level 1',
        2: 'Level 2',
        3: 'Level 3',
        4: 'Level 4',
        5: 'Level 5',
        6: 'Level 6',
        7: 'Level 7 (lowest)'
    },
    'Lava, stationary': {# 11
        0: 'Level 0 (highest)',
        1: 'Level 1',
        2: 'Level 2',
        3: 'Level 3',
        4: 'Level 4',
        5: 'Level 5',
        6: 'Level 6',
        7: 'Level 7 (lowest)'
    },
    'Nether reactor core': {# 247
        0: 'Unused',
        1: 'Active',
        2: 'Stopped / used up'
    }
}
if __name__ == "__main__":
    import json
    for block in BLOCKS:
        print("{0}, \"{1}\"".format(str(block[1]).ljust(3," "),block[0]))
        if block[0] in SUBTYPES:
            for ind, typ in SUBTYPES[block[0]].items():
                print("       {0}, \"{1}\"".format(str(ind),typ))